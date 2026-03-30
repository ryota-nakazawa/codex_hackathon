const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createApp } = require("../server/app");

async function startServer() {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

async function request(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return { response, data };
}

test("health endpoint responds", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/health`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  } finally {
    await app.close();
  }
});

test("bootstrap returns clinic site and dashboard seed data", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/bootstrap`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(typeof data.clinic.name, "string");
    assert.ok(Array.isArray(data.appointments));
    assert.ok(Array.isArray(data.patients));
  } finally {
    await app.close();
  }
});

test("rejects empty input", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, { mode: "fallback" });
    assert.equal(response.status, 400);
    assert.equal(data.ok, false);
  } finally {
    await app.close();
  }
});

test("creates appointment from reservation form input", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientName: "青木 さやか",
        kana: "アオキ サヤカ",
        phone: "090-8888-9999",
        preferredDate: "2026-04-10T10:30:00+09:00",
        preferredTime: "10:30",
        visitType: "初診",
        reason: "一般歯科 / 左下がしみる",
        chiefComplaint: "左下臼歯の冷水痛",
        concernArea: "左下臼歯部",
        symptoms: "冷たいものがしみる",
        patientRequest: "原因を知って安心したい",
        consultationNotes: "2週間前から違和感あり",
        notes: "2週間前から違和感あり",
        firstVisit: true
      })
    });
    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.ok, true);
    assert.equal(data.appointment.patientName, "青木 さやか");
    assert.equal(data.patient.name, "青木 さやか");
    assert.equal(data.appointment.chiefComplaint, "左下臼歯の冷水痛");
    assert.equal(data.appointment.concernArea, "左下臼歯部");
    assert.equal(data.appointment.patientInterview.chiefComplaint, "左下臼歯の冷水痛");
    assert.equal(data.appointment.patientInterview.concernArea, "左下臼歯部");
  } finally {
    await app.close();
  }
});

test("returns patient detail with reports and xray metadata", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/patients/p-001`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.patient.id, "p-001");
    assert.ok(Array.isArray(data.reports));
    assert.ok(Array.isArray(data.xrayStudies));
    assert.ok(data.caseContext);
    assert.equal(data.caseContext.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.caseContext.concernArea, "右上臼歯部");
    assert.match(data.caseContext.summary, /右上臼歯部/);
    assert.equal(data.caseContext.patientInterview.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.caseContext.patientInterview.concernArea, "右上臼歯部");
  } finally {
    await app.close();
  }
});

test("adds report record to patient detail", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/patients/p-001/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "次回来院前の確認事項",
        body: "右上のしみる症状が続く。冷水痛と咬合時違和感を再確認したい。"
      })
    });
    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.ok, true);
    assert.equal(data.patientDetail.patient.id, "p-001");
    assert.equal(data.patientDetail.reports[0].title, "次回来院前の確認事項");
  } finally {
    await app.close();
  }
});

test("uploads xray image and creates analysis report", async () => {
  const app = await startServer();
  try {
    const response = await fetch(`${app.baseUrl}/api/patients/p-001/xrays/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "fallback",
        bodyPart: "右上臼歯部",
        view: "デンタル",
        notes: "レントゲンだけで解析したい。",
        image: {
          name: "xray.png",
          type: "image/png",
          size: 70,
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2X9YQAAAAASUVORK5CYII="
        },
      })
    });
    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.ok, true);
    assert.equal(data.xrayStudy.bodyPart, "右上臼歯部");
    assert.equal(data.report.xrayStudyId, data.xrayStudy.id);
    assert.equal(data.xrayStudy.meta.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.xrayStudy.meta.concernArea, "右上臼歯部");
    assert.equal(data.xrayStudy.meta.analysisContext.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.xrayStudy.meta.previewUrl.startsWith("data:image/png;base64,"), true);
    assert.equal(data.report.patientInterview.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.report.patientInterview.concernArea, "右上臼歯部");
    assert.equal(data.report.analysisContext.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.report.sections.quickOverview.highlights[0], "右上の歯がしみる");
    assert.ok(Array.isArray(data.report.sections.checklist));
    assert.equal(data.patientDetail.caseContext.chiefComplaint, "右上の歯がしみる");
    assert.equal(data.patientDetail.patient.id, "p-001");
    assert.equal(data.patientDetail.reports[0].xrayStudyId, data.xrayStudy.id);
    assert.equal(data.patientDetail.xrayStudies[0].id, data.xrayStudy.id);
    assert.equal(data.patientDetail.patient.history[0].type, "レントゲンAI解析");
  } finally {
    await app.close();
  }
});

test("notes only sets image constraint flag", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, {
      mode: "fallback",
      chartNotes: "右上臼歯の痛み。既往にクラウンあり。",
      patientRequest: "痛みを抑えたい。"
    });

    assert.equal(response.status, 200);
    assert.equal(data.report.meta.modeUsed, "fallback");
    assert.equal(data.report.meta.constraintFlags.avoidImageDerivedSuggestions, true);
    assert.equal(data.report.meta.constraintFlags.avoidBackgroundClaims, false);
  } finally {
    await app.close();
  }
});

test("image only sets background constraint flag", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, {
      mode: "fallback",
      image: {
        name: "xray.png",
        type: "image/png",
        size: 70,
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2X9YQAAAAASUVORK5CYII="
      }
    });

    assert.equal(response.status, 200);
    assert.equal(data.report.meta.constraintFlags.avoidBackgroundClaims, true);
    assert.equal(data.report.meta.inputSummary.hasImage, true);
    assert.equal(data.report.meta.inputSummary.hasTextInputs, false);
  } finally {
    await app.close();
  }
});

test("mock mode stays on mock path", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, {
      mode: "mock",
      chartNotes: "前歯の見た目が気になる。"
    });

    assert.equal(response.status, 200);
    assert.equal(data.report.meta.modeUsed, "mock");
  } finally {
    await app.close();
  }
});

test("live mode falls back when API key is absent", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, {
      mode: "live",
      chartNotes: "冷水痛あり。"
    });

    assert.equal(response.status, 200);
    assert.match(data.report.meta.modeUsed, /^(live|fallback)$/);
  } finally {
    await app.close();
  }
});

test("dangerous input is sanitized in output", async () => {
  const app = await startServer();
  try {
    const { response, data } = await request(app.baseUrl, {
      mode: "fallback",
      chartNotes: "<script>alert(1)</script>痛みがある"
    });

    assert.equal(response.status, 200);
    assert.doesNotMatch(data.report.sections.summary, /<script>/);
    assert.doesNotMatch(data.report.markdown, /<script>/);
  } finally {
    await app.close();
  }
});

test("oversized text input is rejected", async () => {
  const app = await startServer();
  try {
    const { response } = await request(app.baseUrl, {
      mode: "fallback",
      chartNotes: "a".repeat(7000)
    });

    assert.equal(response.status, 400);
  } finally {
    await app.close();
  }
});

test("invalid image type is rejected", async () => {
  const app = await startServer();
  try {
    const { response } = await request(app.baseUrl, {
      mode: "fallback",
      image: {
        name: "xray.gif",
        type: "image/gif",
        size: 10,
        dataUrl: "data:image/gif;base64,R0lGODdhAQABAIAAAAUEBA=="
      }
    });

    assert.equal(response.status, 400);
  } finally {
    await app.close();
  }
});
