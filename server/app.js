const fs = require("fs");
const path = require("path");
const { config } = require("./config");
const { createClinicStore } = require("./clinic-store");
const { generateReport } = require("./report-service");
const {
  createValidationError,
  normalizeIdentifier,
  validateAppointmentPayload,
  validateGeneratePayload,
  validatePatientReportPayload,
  validatePatientPayload,
  validateXrayAnalysisPayload
} = require("./validation");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const requestCounters = new Map();

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function sendCreatedJson(res, payload, location = "") {
  if (location) {
    res.setHeader("Location", location);
  }
  sendJson(res, 201, payload);
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return;
  }

  const host = req.headers.host;
  if (!host) {
    throw createValidationError("Host ヘッダーが不足しています。");
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw createValidationError("Origin ヘッダーが不正です。");
  }

  if (parsedOrigin.host !== host) {
    throw createValidationError("Cross-origin requests are not allowed.", 403);
  }
}

function isRateLimited(req) {
  const now = Date.now();
  const clientKey = req.socket.remoteAddress || "unknown";
  const current = requestCounters.get(clientKey);

  if (!current || now - current.windowStart >= config.rateLimitWindowMs) {
    requestCounters.set(clientKey, { windowStart: now, count: 1 });
    return false;
  }

  current.count += 1;
  if (current.count > config.rateLimitMaxRequests) {
    return true;
  }

  return false;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(createValidationError("リクエストサイズが上限を超えています。", 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(createValidationError("JSON の解析に失敗しました。"));
      }
    });

    req.on("error", reject);
  });
}

async function serveStatic(req, res, pathname) {
  let relativePath = pathname;
  if (pathname === "/") {
    relativePath = "/index.html";
  } else if (pathname === "/reserve") {
    relativePath = "/reserve.html";
  } else if (pathname === "/dashboard") {
    relativePath = "/dashboard.html";
  } else if (/^\/patients\/[^/]+$/.test(pathname)) {
    relativePath = "/patient.html";
  }
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(config.staticDir, normalized);

  if (!filePath.startsWith(config.staticDir)) {
    throw createValidationError("許可されていないパスです。", 403);
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      throw createValidationError("ファイルが見つかりません。", 404);
    }
    const extension = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME_TYPES[extension] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createValidationError("ファイルが見つかりません。", 404);
    }
    throw error;
  }
}

function createApp(options = {}) {
  const store = options.store || createClinicStore();

  return async function app(req, res) {
    setSecurityHeaders(res);

    try {
      if (isRateLimited(req)) {
        throw createValidationError("リクエストが多すぎます。少し時間を空けて再試行してください。", 429);
      }

      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const segments = url.pathname.split("/").filter(Boolean);

      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true, status: "healthy" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/bootstrap") {
        sendJson(res, 200, store.getBootstrap());
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/appointments") {
        sendJson(res, 200, {
          ok: true,
          appointments: store.listAppointments()
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/patients") {
        sendJson(res, 200, {
          ok: true,
          patients: store.listPatients()
        });
        return;
      }

      if (req.method === "GET" && segments.length === 3 && segments[0] === "api" && segments[1] === "patients") {
        const patientId = normalizeIdentifier(decodeURIComponent(segments[2]), "患者ID");
        const detail = store.getPatientDetail(patientId);
        if (!detail) {
          throw createValidationError("患者が見つかりません。", 404);
        }
        sendJson(res, 200, {
          ok: true,
          ...detail
        });
        return;
      }

      if (req.method === "POST" && segments.length === 4 && segments[0] === "api" && segments[1] === "patients" && segments[3] === "reports") {
        assertSameOrigin(req);
        if (!String(req.headers["content-type"] || "").includes("application/json")) {
          throw createValidationError("Content-Type は application/json を指定してください。");
        }
        const patientId = normalizeIdentifier(decodeURIComponent(segments[2]), "患者ID");
        const payload = await parseJsonBody(req);
        const input = validatePatientReportPayload(payload);
        const report = store.addDiagnosticReport(patientId, input);
        if (!report) {
          throw createValidationError("患者が見つかりません。", 404);
        }
        sendCreatedJson(res, {
          ok: true,
          report,
          patientDetail: store.getPatientDetail(patientId)
        }, `/api/patients/${patientId}`);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/patients") {
        assertSameOrigin(req);
        if (!String(req.headers["content-type"] || "").includes("application/json")) {
          throw createValidationError("Content-Type は application/json を指定してください。");
        }
        const payload = await parseJsonBody(req);
        const input = validatePatientPayload(payload);
        const patient = store.createPatient(input);
        sendCreatedJson(res, {
          ok: true,
          patient,
          patientDetail: store.getPatientDetail(patient.id)
        }, `/api/patients/${patient.id}`);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/appointments") {
        assertSameOrigin(req);
        if (!String(req.headers["content-type"] || "").includes("application/json")) {
          throw createValidationError("Content-Type は application/json を指定してください。");
        }
        const payload = await parseJsonBody(req);
        const input = validateAppointmentPayload(payload);
        const result = store.createAppointment(input);
        if (result.error) {
          throw createValidationError(result.error, result.statusCode || 400);
        }
        sendCreatedJson(res, {
          ok: true,
          appointment: result.appointment,
          patient: result.patient,
          appointments: store.listAppointments(),
          patients: store.listPatients()
        }, `/api/patients/${result.patient.id}`);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/generate-report") {
        assertSameOrigin(req);
        if (!String(req.headers["content-type"] || "").includes("application/json")) {
          throw createValidationError("Content-Type は application/json を指定してください。");
        }
        const payload = await parseJsonBody(req);
        const input = validateGeneratePayload(payload);
        const report = await generateReport(input);
        sendJson(res, 200, { ok: true, report });
        return;
      }

      if (req.method === "POST" && segments.length === 5 && segments[0] === "api" && segments[1] === "patients" && segments[3] === "xrays" && segments[4] === "analyze") {
        assertSameOrigin(req);
        if (!String(req.headers["content-type"] || "").includes("application/json")) {
          throw createValidationError("Content-Type は application/json を指定してください。");
        }
        const patientId = normalizeIdentifier(decodeURIComponent(segments[2]), "患者ID");
        const patientRecord = store.getPatientRecord(patientId);
        if (!patientRecord) {
          throw createValidationError("患者が見つかりません。", 404);
        }
        const payload = await parseJsonBody(req);
        const input = validateXrayAnalysisPayload(payload);
        const report = await generateReport({
          mode: input.mode,
          patientId,
          caseId: `XRAY-${patientId}`,
          patientRequest: input.notes || patientRecord.mainConcern || patientRecord.chiefComplaint || "",
          chartNotes: input.notes || patientRecord.notes || "",
          image: input.image
        });
        const analysis = store.addXrayAnalysis(patientId, input, report);
        if (!analysis) {
          throw createValidationError("患者が見つかりません。", 404);
        }
        sendCreatedJson(res, {
          ok: true,
          xrayStudy: analysis.xrayStudy,
          report: analysis.report,
          patientDetail: store.getPatientDetail(patientId)
        }, `/api/patients/${patientId}`);
        return;
      }

      if (req.method === "GET") {
        await serveStatic(req, res, url.pathname);
        return;
      }

      throw createValidationError("未対応のメソッドです。", 405);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(res, statusCode, {
        ok: false,
        error: statusCode >= 500 ? "サーバエラーが発生しました。" : error.message
      });
    }
  };
}

module.exports = {
  createApp
};
