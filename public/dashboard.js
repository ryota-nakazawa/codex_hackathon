import { apiFetch, escapeHtml, formatDateTime, setMessage, statusClass } from "/common.js";

const state = {
  bootstrap: null
};

const elements = {
  dashboardStats: document.getElementById("dashboardStats"),
  appointmentList: document.getElementById("appointmentList"),
  patientForm: document.getElementById("patientForm"),
  patientRegisterFeedback: document.getElementById("patientRegisterFeedback"),
  reloadBootstrap: document.getElementById("reloadBootstrap")
};

function renderDashboard() {
  const { stats, appointments } = state.bootstrap;

  elements.dashboardStats.innerHTML = [
    ["患者数", stats.totalPatients],
    ["予約数", stats.totalAppointments],
    ["近日予約", stats.upcomingAppointments],
    ["レポート数", stats.reportCount]
  ]
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <small>${escapeHtml(label)}</small>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  elements.appointmentList.innerHTML = appointments
    .map(
      (appointment) => `
        <button class="appointment-card" type="button" data-patient-id="${escapeHtml(appointment.patientId)}">
          <div class="card-row">
            <span class="status-pill ${statusClass(appointment.status)}">${escapeHtml(appointment.status)}</span>
            <span class="pill subtle">${escapeHtml(appointment.visitType)}</span>
          </div>
          <h3>${escapeHtml(appointment.patientName)}</h3>
          <p>${escapeHtml(appointment.reason)}</p>
          <small>${escapeHtml(formatDateTime(appointment.scheduledAt))} / ${escapeHtml(appointment.doctorName || "未定")}</small>
        </button>
      `
    )
    .join("");
}

async function refreshBootstrap() {
  state.bootstrap = await apiFetch("/api/bootstrap");
  renderDashboard();
}

async function submitPatient(event) {
  event.preventDefault();
  const formData = new FormData(elements.patientForm);
  const note = String(formData.get("note") || "").trim();
  const response = await apiFetch("/api/patients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: String(formData.get("name") || "").trim(),
      kana: String(formData.get("kana") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      birthDate: String(formData.get("birthDate") || "").trim(),
      sex: String(formData.get("gender") || "").trim(),
      chiefComplaint: note,
      notes: note
    })
  });

  setMessage(
    elements.patientRegisterFeedback,
    "success",
    `${response.patient.name} さんを登録しました。患者詳細へ移動します。`
  );
  window.location.assign(`/patients/${encodeURIComponent(response.patient.id)}`);
}

async function init() {
  await refreshBootstrap();

  elements.reloadBootstrap.addEventListener("click", () => {
    refreshBootstrap().catch((error) => {
      console.error(error);
    });
  });

  elements.appointmentList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-patient-id]");
    if (!target) {
      return;
    }
    window.location.assign(`/patients/${encodeURIComponent(target.getAttribute("data-patient-id"))}`);
  });

  elements.patientForm.addEventListener("submit", (event) => {
    submitPatient(event).catch((error) => {
      setMessage(elements.patientRegisterFeedback, "error", error.message);
    });
  });
}

init().catch((error) => {
  console.error(error);
});
