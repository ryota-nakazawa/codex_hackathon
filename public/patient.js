import { apiFetch, escapeHtml, formatDate, formatDateTime, setMessage, statusClass } from "/common.js";

const patientId = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

const elements = {
  patientTitle: document.getElementById("patientTitle"),
  patientLead: document.getElementById("patientLead"),
  patientProfile: document.getElementById("patientProfile"),
  patientAppointments: document.getElementById("patientAppointments"),
  patientReports: document.getElementById("patientReports"),
  patientXrays: document.getElementById("patientXrays"),
  patientReportForm: document.getElementById("patientReportForm"),
  patientReportFeedback: document.getElementById("patientReportFeedback"),
  xrayAnalysisForm: document.getElementById("xrayAnalysisForm"),
  xrayAnalysisFeedback: document.getElementById("xrayAnalysisFeedback"),
  xrayAnalysisResult: document.getElementById("xrayAnalysisResult")
};

let patientDetail = null;

function renderPatient() {
  const { patient, appointments, reports, xrayStudies } = patientDetail;
  const latestAnalysisReport = reports.find((report) => report.xrayStudyId) || reports[0] || null;
  const latestAnalysisStudy = latestAnalysisReport
    ? xrayStudies.find((study) => study.id === latestAnalysisReport.xrayStudyId) || null
    : null;

  document.title = `${patient.name} | 患者詳細`;
  elements.patientTitle.textContent = `${patient.name} さんの患者詳細`;
  elements.patientLead.textContent = patient.mainConcern || patient.chiefComplaint || "主訴未設定";

  elements.patientProfile.innerHTML = [
    ["患者番号", patient.patientNumber || patient.patientNo || patient.id],
    ["氏名", patient.name],
    ["ふりがな", patient.kana || "未設定"],
    ["電話番号", patient.phone || "未設定"],
    ["性別", patient.sex || "未設定"],
    ["初診日", formatDate(patient.firstVisitAt)],
    ["次回予約", formatDateTime(patient.nextAppointmentAt)]
  ]
    .map(
      ([label, value]) => `
        <article class="kv-card">
          <small>${escapeHtml(label)}</small>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  elements.patientAppointments.innerHTML = (appointments.length ? appointments : [{ visitType: "予約なし", status: "未登録", reason: "現在予約はありません。", scheduledAt: "" }])
    .map(
      (appointment) => `
        <article class="list-card">
          <div class="card-row">
            <span class="pill">${escapeHtml(appointment.visitType)}</span>
            <span class="status-pill ${statusClass(appointment.status)}">${escapeHtml(appointment.status)}</span>
          </div>
          <p>${escapeHtml(appointment.reason || "理由未設定")}</p>
          <small>${escapeHtml(formatDateTime(appointment.scheduledAt))}</small>
        </article>
      `
    )
    .join("");

  elements.patientReports.innerHTML = (reports.length ? reports : [{ title: "履歴なし", summary: "まだレポートはありません。", checkpoints: [] }])
    .map(
      (report) => `
        <article class="list-card">
          <div class="card-row">
            <span class="pill">${escapeHtml(report.title || "診断補助レポート")}</span>
            <span class="pill subtle">${escapeHtml(formatDateTime(report.createdAt))}</span>
          </div>
          <p>${escapeHtml(report.summary)}</p>
          <small>${escapeHtml((report.checkpoints || []).join(" / ") || "確認ポイントなし")}</small>
        </article>
      `
    )
    .join("");

  elements.patientXrays.innerHTML = (xrayStudies.length ? xrayStudies : [{ view: "画像なし", bodyPart: "未登録", reportSummary: "まだ画像メタ情報はありません。", findingHints: [] }])
    .map(
      (xray) => `
        <article class="list-card">
          <h3>${escapeHtml(xray.view)}</h3>
          <p>${escapeHtml(xray.bodyPart)}</p>
          <small>${escapeHtml(xray.reportSummary || "説明メモなし")}</small>
          <small>${escapeHtml((xray.findingHints || []).join(" / ") || "ヒントなし")}</small>
        </article>
      `
    )
    .join("");

  elements.xrayAnalysisResult.innerHTML = latestAnalysisReport
    ? `
      <article class="list-card">
        <div class="card-row">
          <span class="pill">最新のAI解析</span>
          <span class="pill subtle">${escapeHtml(formatDateTime(latestAnalysisReport.createdAt))}</span>
          <span class="status-pill tone-calm">${escapeHtml(latestAnalysisStudy?.meta?.analysisMode || "未設定")}</span>
        </div>
        <p>${escapeHtml(latestAnalysisReport.summary)}</p>
        <small>${escapeHtml((latestAnalysisReport.checkpoints || []).join(" / ") || "確認ポイントなし")}</small>
      </article>
    `
    : `
      <article class="list-card">
        <h3>解析待ち</h3>
        <p>レントゲン画像をアップロードすると、この枠にAI解析レポートが表示されます。</p>
      </article>
    `;
}

async function loadPatient() {
  patientDetail = await apiFetch(`/api/patients/${encodeURIComponent(patientId)}`);
  renderPatient();
}

async function submitPatientReport(event) {
  event.preventDefault();
  const formData = new FormData(elements.patientReportForm);
  const response = await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: String(formData.get("title") || "").trim(),
      body: String(formData.get("body") || "").trim()
    })
  });

  patientDetail = response.patientDetail;
  renderPatient();
  elements.patientReportForm.reset();
  setMessage(elements.patientReportFeedback, "success", "患者詳細に新しい記録を追加しました。");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });
}

async function submitXrayAnalysis(event) {
  event.preventDefault();
  const formData = new FormData(elements.xrayAnalysisForm);
  const file = formData.get("xrayImage");
  if (!(file instanceof File) || !file.size) {
    throw new Error("レントゲン画像を選択してください。");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const response = await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/xrays/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: "live",
      image: {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      },
      bodyPart: String(formData.get("bodyPart") || "").trim(),
      view: String(formData.get("view") || "").trim(),
      notes: String(formData.get("notes") || "").trim()
    })
  });

  patientDetail = response.patientDetail;
  renderPatient();
  elements.xrayAnalysisForm.reset();
  setMessage(
    elements.xrayAnalysisFeedback,
    "success",
    `${response.xrayStudy.view || "レントゲン"} のAI解析を保存しました。患者履歴とレポートに反映されています。`
  );
}

async function init() {
  await loadPatient();
  elements.patientReportForm.addEventListener("submit", (event) => {
    submitPatientReport(event).catch((error) => {
      setMessage(elements.patientReportFeedback, "error", error.message);
    });
  });
  elements.xrayAnalysisForm.addEventListener("submit", (event) => {
    submitXrayAnalysis(event).catch((error) => {
      setMessage(elements.xrayAnalysisFeedback, "error", error.message);
    });
  });
}

init().catch((error) => {
  console.error(error);
  elements.patientTitle.textContent = "患者詳細";
  elements.patientLead.textContent = error.message;
});
