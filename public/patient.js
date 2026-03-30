import { apiFetch, escapeHtml, formatDateTime, setMessage } from "/common.js";

const patientId = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

const elements = {
  patientTitle: document.getElementById("patientTitle"),
  patientLead: document.getElementById("patientLead"),
  patientMeta: document.getElementById("patientMeta"),
  reportHistoryList: document.getElementById("reportHistoryList"),
  reservationContext: document.getElementById("reservationContext"),
  selectedCaseMeta: document.getElementById("selectedCaseMeta"),
  workspaceImage: document.getElementById("workspaceImage"),
  reportSummaryPanel: document.getElementById("reportSummaryPanel"),
  reportChecklistPanel: document.getElementById("reportChecklistPanel"),
  reportExplanationPanel: document.getElementById("reportExplanationPanel"),
  patientReportForm: document.getElementById("patientReportForm"),
  patientReportFeedback: document.getElementById("patientReportFeedback"),
  xrayAnalysisForm: document.getElementById("xrayAnalysisForm"),
  resetAnalysisForm: document.getElementById("resetAnalysisForm"),
  xrayAnalysisFeedback: document.getElementById("xrayAnalysisFeedback")
};

let patientDetail = null;
let selectedReportId = "";

function getReports() {
  return patientDetail?.reports || [];
}

function getXrayStudies() {
  return patientDetail?.xrayStudies || [];
}

function getCaseContext() {
  return patientDetail?.caseContext || {};
}

function ensureSelectedReport() {
  const reports = getReports();
  if (!reports.length) {
    selectedReportId = "";
    return null;
  }

  const selected = reports.find((report) => report.id === selectedReportId);
  if (selected) {
    return selected;
  }

  selectedReportId = reports[0].id;
  return reports[0];
}

function getSelectedStudy(report = ensureSelectedReport()) {
  const studies = getXrayStudies();
  if (!studies.length) {
    return null;
  }

  if (report?.xrayStudyId) {
    const matched = studies.find((study) => study.id === report.xrayStudyId);
    if (matched) {
      return matched;
    }
  }

  return studies[0] || null;
}

function resolveXrayImageUrl(study) {
  if (!study) {
    return "/assets/xrays/panorama-01.png";
  }

  if (study.meta?.previewUrl) {
    return study.meta.previewUrl;
  }

  if (typeof study.storageHint === "string" && (study.storageHint.startsWith("/assets/") || study.storageHint.startsWith("data:image/"))) {
    return study.storageHint;
  }

  if (typeof study.fileName === "string" && study.fileName) {
    return `/assets/xrays/${encodeURIComponent(study.fileName)}`;
  }

  return "/assets/xrays/panorama-01.png";
}

function renderPatientHeader() {
  const { patient, reports, xrayStudies } = patientDetail;
  const caseContext = getCaseContext();

  document.title = `${patient.name} | 患者詳細`;
  elements.patientTitle.textContent = patient.name;
  elements.patientLead.textContent =
    caseContext.summary ||
    [caseContext.chiefComplaint, caseContext.concernArea, caseContext.patientRequest].filter(Boolean).join(" / ") ||
    patient.mainConcern ||
    patient.chiefComplaint ||
    "主訴未設定";

  elements.patientMeta.innerHTML = [
    ["患者番号", patient.patientNumber || patient.patientNo || patient.id],
    ["次回予約", formatDateTime(patient.nextAppointmentAt)],
    ["過去レポート", `${reports.length}件`],
    ["画像", `${xrayStudies.length}件`]
  ]
    .map(
      ([label, value]) => `
        <article class="meta-card">
          <small>${escapeHtml(label)}</small>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");
}

function renderHistoryList() {
  const reports = getReports();
  const selectedReport = ensureSelectedReport();

  elements.reportHistoryList.innerHTML = reports.length
    ? reports
        .map(
          (report) => `
            <button type="button" class="history-card ${selectedReport?.id === report.id ? "is-selected" : ""}" data-report-id="${escapeHtml(report.id)}">
              <div class="history-card-top">
                <strong>${escapeHtml(report.title || "診断補助レポート")}</strong>
                <small>${escapeHtml(formatDateTime(report.createdAt))}</small>
              </div>
              <p>${escapeHtml(report.summary || report.quickOverview?.summary || "概要未設定")}</p>
            </button>
          `
        )
        .join("")
    : `
        <article class="empty-card">
          <h3>履歴なし</h3>
          <p>まだレポートはありません。</p>
        </article>
      `;

  elements.reportHistoryList.querySelectorAll("[data-report-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedReportId = button.dataset.reportId || "";
      renderPage();
    });
  });
}

function renderReservationContext() {
  const caseContext = getCaseContext();
  const latestAppointment = patientDetail.latestAppointment || {};

  const items = [
    ["主訴", caseContext.chiefComplaint || "未設定"],
    ["疾患部", caseContext.concernArea || "未設定"],
    ["患者要望", caseContext.patientRequest || "未設定"],
    ["患者コメント", caseContext.consultationNotes || latestAppointment.notes || "未設定"],
    ["予約日時", formatDateTime(latestAppointment.scheduledAt)]
  ];

  elements.reservationContext.innerHTML = items
    .map(
      ([label, value]) => `
        <article class="context-card">
          <small>${escapeHtml(label)}</small>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");
}

function renderWorkspace() {
  const report = ensureSelectedReport();
  const study = getSelectedStudy(report);
  const caseContext = getCaseContext();

  elements.selectedCaseMeta.innerHTML = [
    patientDetail.patient.patientNumber || patientDetail.patient.id,
    study?.view || "画像未登録",
    study?.bodyPart || caseContext.concernArea || "部位未設定"
  ]
    .map((item) => `<span class="workspace-tag">${escapeHtml(item)}</span>`)
    .join("");

  elements.workspaceImage.innerHTML = `
    <div class="workspace-hero">
      <div class="workspace-image-card">
        <div class="workspace-image-meta">
          <small>レントゲン画像</small>
          <strong>${escapeHtml(study?.fileName || "アップロード待ち")}</strong>
        </div>
        <figure class="workspace-figure">
          <img src="${escapeHtml(resolveXrayImageUrl(study))}" alt="${escapeHtml(study?.view || "レントゲン画像")}" />
        </figure>
      </div>
      <aside class="workspace-context-card">
        <small>RESERVATION COMMENT</small>
        <h3>${escapeHtml(patientDetail.patient.name)} さんの予約内容</h3>
        <div class="workspace-context-list">
          <article>
            <span>主訴</span>
            <strong>${escapeHtml(caseContext.chiefComplaint || "未設定")}</strong>
          </article>
          <article>
            <span>疾患部</span>
            <strong>${escapeHtml(caseContext.concernArea || "未設定")}</strong>
          </article>
          <article>
            <span>患者要望</span>
            <strong>${escapeHtml(caseContext.patientRequest || "未設定")}</strong>
          </article>
          <article>
            <span>患者コメント</span>
            <strong>${escapeHtml(caseContext.consultationNotes || "未設定")}</strong>
          </article>
        </div>
      </aside>
    </div>
  `;
}

function renderReportBoard() {
  const report = ensureSelectedReport();

  if (!report) {
    elements.reportSummaryPanel.innerHTML = `<div class="section-label dark">AI Summary</div><h2>解析サマリー</h2><p>まだレポートはありません。</p>`;
    elements.reportChecklistPanel.innerHTML = `<div class="section-label dark">Doctor Checklist</div><h2>確認ポイント</h2><p>確認項目はありません。</p>`;
    elements.reportExplanationPanel.innerHTML = `<div class="section-label dark">Patient Explanation</div><h2>説明文の下書き</h2><p>説明文はありません。</p>`;
    return;
  }

  elements.reportSummaryPanel.innerHTML = `
    <div class="section-label dark">AI Summary</div>
    <h2>解析サマリー</h2>
    <p class="report-main-copy">${escapeHtml(report.summary || report.quickOverview?.summary || "概要未設定")}</p>
  `;

  elements.reportChecklistPanel.innerHTML = `
    <div class="section-label dark">Doctor Checklist</div>
    <h2>確認ポイント</h2>
    <ul class="result-list">
      ${(report.checklist || report.checkpoints || ["確認ポイントなし"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;

  elements.reportExplanationPanel.innerHTML = `
    <div class="section-label dark">Patient Explanation</div>
    <h2>説明文の下書き</h2>
    <p class="report-main-copy">${escapeHtml(report.explanation?.patient || report.patientExplanation || "説明文なし")}</p>
    <div class="clinician-note">
      <strong>院内メモ</strong>
      <p>${escapeHtml(report.explanation?.clinician || "院内向け補足なし")}</p>
    </div>
  `;
}

function renderPage() {
  renderPatientHeader();
  renderReservationContext();
  renderHistoryList();
  renderWorkspace();
  renderReportBoard();
}

async function loadPatient() {
  patientDetail = await apiFetch(`/api/patients/${encodeURIComponent(patientId)}`);
  renderPage();
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
  selectedReportId = response.report.id;
  renderPage();
  elements.patientReportForm.reset();
  setMessage(elements.patientReportFeedback, "success", "患者詳細に新しい記録を追加しました。");
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(blob);
  });
}

async function submitXrayAnalysis(event) {
  event.preventDefault();
  const formData = new FormData(elements.xrayAnalysisForm);
  const file = formData.get("xrayImage");

  if (!(file instanceof File) || !file.size) {
    throw new Error("レントゲン画像を選択してください。");
  }

  const caseContext = getCaseContext();
  const currentStudy = getSelectedStudy();
  const extraNotes = String(formData.get("notes") || "").trim();

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
        dataUrl: await readBlobAsDataUrl(file)
      },
      bodyPart: currentStudy?.bodyPart || caseContext.concernArea || "",
      view: currentStudy?.view || "",
      concernArea: caseContext.concernArea || "",
      consultationNotes: caseContext.consultationNotes || "",
      notes: [caseContext.consultationNotes, extraNotes].filter(Boolean).join(" / ")
    })
  });

  patientDetail = response.patientDetail;
  selectedReportId = response.report.id;
  elements.xrayAnalysisForm.reset();
  renderPage();
  setMessage(
    elements.xrayAnalysisFeedback,
    "success",
    `${response.xrayStudy.view || "レントゲン"} のAI解析を保存しました。予約時ヒアリングを使ってレポートを更新しました。`
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

  if (elements.resetAnalysisForm) {
    elements.resetAnalysisForm.addEventListener("click", () => {
      elements.xrayAnalysisForm.reset();
      setMessage(elements.xrayAnalysisFeedback, "info", "入力をクリアしました。");
    });
  }
}

init().catch((error) => {
  console.error(error);
  elements.patientTitle.textContent = "患者詳細";
  elements.patientLead.textContent = error.message;
});
