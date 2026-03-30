import { apiFetch, escapeHtml, formatDateTime, setMessage } from "/common.js";

const state = {
  bootstrap: null,
  lastAppointmentResult: null
};

const elements = {
  reserveStatusCard: document.getElementById("reserveStatusCard"),
  reservationHints: document.getElementById("reservationHints"),
  appointmentForm: document.getElementById("appointmentForm"),
  appointmentFeedback: document.getElementById("appointmentFeedback"),
  appointmentSummary: document.getElementById("appointmentSummary"),
  resetAppointmentForm: document.getElementById("resetAppointmentForm")
};

function renderPage() {
  const { bookingForm, clinic } = state.bootstrap;
  const timeSelect = elements.appointmentForm.querySelector('select[name="time"]');
  timeSelect.innerHTML = bookingForm.preferredTimeOptions
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");

  elements.reserveStatusCard.innerHTML = `
    <strong>${bookingForm.fields.length}項目の入力</strong>
    <p>初診・再診を分けつつ、患者が迷いにくい最小構成にしています。</p>
  `;

  elements.reservationHints.innerHTML = clinic.reservation.formHints
    .concat(["送信した予約は管理画面の予約一覧へ反映", "急ぎの痛みは電話連絡を優先"])
    .map(
      (hint) => `
        <li class="bullet-item">${escapeHtml(hint)}</li>
      `
    )
    .join("");

  if (!state.lastAppointmentResult) {
    elements.appointmentSummary.innerHTML = "";
    setMessage(elements.appointmentFeedback, "info", "予約を送信すると、この欄に受付結果が表示されます。");
    return;
  }

  const { appointment, patient } = state.lastAppointmentResult;
  setMessage(
    elements.appointmentFeedback,
    "success",
    `${patient.name} さんの予約を受け付けました。管理画面の予約一覧で確認できます。`
  );
  elements.appointmentSummary.innerHTML = [
    ["患者名", patient.name],
    ["予約日時", formatDateTime(appointment.scheduledAt)],
    ["予約種別", appointment.visitType],
    ["相談内容", appointment.reason || "未入力"]
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
}

async function submitAppointment(event) {
  event.preventDefault();
  const formData = new FormData(elements.appointmentForm);
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const visitType = String(formData.get("visitType") || "初診");
  const notes = String(formData.get("notes") || "").trim();

  const response = await apiFetch("/api/appointments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientName: String(formData.get("name") || "").trim(),
      kana: String(formData.get("kana") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      preferredDate: new Date(`${date}T${time}:00+09:00`).toISOString(),
      preferredTime: time,
      visitType,
      reason: notes || "相談内容未入力",
      notes,
      firstVisit: visitType === "初診"
    })
  });

  state.lastAppointmentResult = {
    appointment: response.appointment,
    patient: response.patient
  };
  renderPage();
}

async function init() {
  state.bootstrap = await apiFetch("/api/bootstrap");
  renderPage();

  elements.resetAppointmentForm.addEventListener("click", () => {
    elements.appointmentForm.reset();
    state.lastAppointmentResult = null;
    renderPage();
  });

  elements.appointmentForm.addEventListener("submit", (event) => {
    submitAppointment(event).catch((error) => {
      setMessage(elements.appointmentFeedback, "error", error.message);
    });
  });
}

init().catch((error) => {
  console.error(error);
});
