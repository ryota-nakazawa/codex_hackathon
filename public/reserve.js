import { apiFetch, escapeHtml, formatDateTime, setMessage } from "/common.js";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const state = {
  bootstrap: null,
  availability: [],
  selectedDayIndex: 0,
  selectedSlotKey: "",
  lastAppointmentResult: null
};

const elements = {
  clinicName: document.getElementById("clinicName"),
  clinicSubline: document.getElementById("clinicSubline"),
  reservePolicyCard: document.getElementById("reservePolicyCard"),
  availabilityMeta: document.getElementById("availabilityMeta"),
  dayTabs: document.getElementById("dayTabs"),
  slotGrid: document.getElementById("slotGrid"),
  selectedSlotSummary: document.getElementById("selectedSlotSummary"),
  appointmentForm: document.getElementById("appointmentForm"),
  appointmentFeedback: document.getElementById("appointmentFeedback"),
  appointmentSummary: document.getElementById("appointmentSummary"),
  resetAppointmentForm: document.getElementById("resetAppointmentForm")
};

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

function cloneDate(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(12, 0, 0, 0);
  return next;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10));
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function parseRanges(hoursText) {
  return hoursText
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((rangeText) => {
      const [start, end] = rangeText.split("-").map((value) => value.trim());
      return {
        start: timeToMinutes(start),
        end: timeToMinutes(end)
      };
    });
}

function createIsoAt(dateKey, timeText) {
  return new Date(`${dateKey}T${timeText}:00+09:00`).toISOString();
}

function getDurationMinutes(appointment) {
  return Math.max(60, Number.parseInt(appointment.durationMinutes || 0, 10) || 0);
}

function isSlotOccupied(slotStart, slotEnd, appointments) {
  return appointments.some((appointment) => {
    if (!appointment.scheduledAt) {
      return false;
    }
    const appointmentStart = new Date(appointment.scheduledAt);
    const appointmentEnd = new Date(appointmentStart.getTime() + getDurationMinutes(appointment) * 60 * 1000);
    return appointmentStart < slotEnd && appointmentEnd > slotStart;
  });
}

function buildAvailability(bootstrap) {
  const leadTimeDays = bootstrap.clinic?.reservation?.leadTimeDays || 1;
  const appointments = bootstrap.appointments || [];
  const availability = [];
  const today = cloneDate(new Date());
  let cursor = addDays(today, leadTimeDays);

  while (availability.length < 14) {
    const dayIndex = cursor.getDay();
    if (dayIndex !== 0) {
      const dateKey = formatYmd(cursor);
      const hoursText = dayIndex === 6 ? bootstrap.clinic.hours.saturday : bootstrap.clinic.hours.weekday;
      const ranges = parseRanges(hoursText);
      const slots = [];

      for (const range of ranges) {
        for (let start = range.start; start + 60 <= range.end; start += 60) {
          const timeText = minutesToTime(start);
          const slotStart = new Date(`${dateKey}T${timeText}:00+09:00`);
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
          const occupied = isSlotOccupied(slotStart, slotEnd, appointments);
          slots.push({
            dateKey,
            timeText,
            iso: slotStart.toISOString(),
            available: !occupied,
            key: `${dateKey} ${timeText}`
          });
        }
      }

      availability.push({
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        weekdayLabel: WEEKDAY_LABELS[dayIndex],
        slots,
        totalCount: slots.length,
        availableCount: slots.filter((slot) => slot.available).length
      });
    }

    cursor = addDays(cursor, 1);
  }

  return availability;
}

function setHiddenSlotFields(slot) {
  const dateInput = elements.appointmentForm.querySelector('input[name="date"]');
  const timeInput = elements.appointmentForm.querySelector('input[name="time"]');
  dateInput.value = slot?.dateKey || "";
  timeInput.value = slot?.timeText || "";
}

function getSelectedSlot() {
  const day = state.availability[state.selectedDayIndex];
  if (!day) {
    return null;
  }
  return day.slots.find((slot) => slot.key === state.selectedSlotKey) || null;
}

function setSelectedSlot(slot) {
  if (!slot) {
    state.selectedSlotKey = "";
    setHiddenSlotFields(null);
    renderPage();
    return;
  }

  state.selectedDayIndex = state.availability.findIndex((day) => day.dateKey === slot.dateKey);
  if (state.selectedDayIndex < 0) {
    state.selectedDayIndex = 0;
  }
  state.selectedSlotKey = slot.key;
  setHiddenSlotFields(slot);
  renderPage();
}

function getFirstAvailableSlot() {
  for (const day of state.availability) {
    const slot = day.slots.find((candidate) => candidate.available);
    if (slot) {
      return slot;
    }
  }
  return null;
}

function renderAvailabilityTabs() {
  elements.dayTabs.innerHTML = state.availability
    .map((day, index) => {
      const isActive = index === state.selectedDayIndex;
      return `
        <button type="button" class="day-tab ${isActive ? "is-active" : ""}" data-day-index="${index}">
          <strong>${escapeHtml(day.dateLabel)}</strong>
          <small>${day.availableCount} / ${day.totalCount} 枠空き</small>
        </button>
      `;
    })
    .join("");

  elements.dayTabs.querySelectorAll("[data-day-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDayIndex = Number.parseInt(button.dataset.dayIndex, 10);
      const nextSlot = state.availability[state.selectedDayIndex]?.slots.find((slot) => slot.available) || null;
      state.selectedSlotKey = nextSlot ? nextSlot.key : "";
      setHiddenSlotFields(nextSlot);
      renderPage();
    });
  });
}

function renderSlotGrid() {
  const day = state.availability[state.selectedDayIndex];
  if (!day) {
    elements.slotGrid.innerHTML = `
      <article class="reserve-empty">
        <h3>空き枠を準備中です</h3>
        <p>予約可能な日付が見つかりませんでした。</p>
      </article>
    `;
    elements.selectedSlotSummary.innerHTML = "";
    return;
  }

  if (!day.slots.length) {
    elements.slotGrid.innerHTML = `
      <article class="reserve-empty">
        <h3>${escapeHtml(day.dateLabel)} は受付外です</h3>
        <p>別の日付を選んでください。</p>
      </article>
    `;
    elements.selectedSlotSummary.innerHTML = "";
    return;
  }

  elements.slotGrid.innerHTML = day.slots
    .map((slot) => {
      const selected = slot.key === state.selectedSlotKey;
      return `
        <button type="button" class="slot-card ${slot.available ? "" : "slot-card--full"} ${selected ? "slot-card--selected" : ""}" data-slot-key="${escapeHtml(slot.key)}" ${slot.available ? "" : "disabled"}>
          <div class="slot-card-head">
            <span class="slot-badge">${escapeHtml(day.weekdayLabel)}</span>
            <span class="slot-status ${slot.available ? "is-open" : "is-full"}">${slot.available ? "空き" : "満席"}</span>
          </div>
          <div class="slot-time">${escapeHtml(slot.timeText)}</div>
          <p>${slot.available ? "この時間で予約できます。" : "すでに予約が入っています。"}</p>
        </button>
      `;
    })
    .join("");

  elements.slotGrid.querySelectorAll("[data-slot-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = day.slots.find((candidate) => candidate.key === button.dataset.slotKey);
      if (slot && slot.available) {
        setSelectedSlot(slot);
      }
    });
  });

  const selectedSlot = getSelectedSlot() || day.slots.find((slot) => slot.available) || null;
  if (selectedSlot && selectedSlot.key !== state.selectedSlotKey) {
    state.selectedSlotKey = selectedSlot.key;
    setHiddenSlotFields(selectedSlot);
  }

  elements.selectedSlotSummary.innerHTML = selectedSlot
    ? `
      <div class="selected-slot-copy">
        <strong>選択中の空き枠</strong>
        <p>${escapeHtml(day.dateLabel)} の ${escapeHtml(selectedSlot.timeText)} を選択しています。1診療60分で受付します。</p>
      </div>
      <span class="selected-slot-pill">選択中</span>
    `
    : `
      <div class="selected-slot-copy">
        <strong>空き枠を選択してください</strong>
        <p>予約したい日付の時間帯をタップすると、下のフォームに反映されます。</p>
      </div>
    `;
}

function renderAppointmentResult() {
  if (!state.lastAppointmentResult) {
    elements.appointmentSummary.innerHTML = "";
    setMessage(elements.appointmentFeedback, "info", "空き枠を選んで送信すると、この欄に受付結果が表示されます。");
    return;
  }

  const { appointment, patient } = state.lastAppointmentResult;
  setMessage(
    elements.appointmentFeedback,
    "success",
    `${patient.name} さんの予約を受け付けました。選択した時間帯を管理画面へ反映しました。`
  );
  elements.appointmentSummary.innerHTML = [
    ["患者名", patient.name],
    ["予約日時", formatDateTime(appointment.scheduledAt)],
    ["予約種別", appointment.visitType],
    ["主訴", appointment.chiefComplaint || appointment.reason || "未入力"],
    ["気になる部位", appointment.concernArea || "未入力"]
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

function renderPage() {
  if (!state.bootstrap) {
    return;
  }

  const { clinic } = state.bootstrap;
  const reservationChannels = (clinic.reservation?.channels || []).join(" / ") || "WEB";
  const nextAvailableDay = state.availability.find((day) => day.availableCount > 0);

  if (elements.clinicName) {
    elements.clinicName.textContent = clinic.name;
  }
  if (elements.clinicSubline) {
    elements.clinicSubline.textContent = clinic.tagline || "患者向け予約導線";
  }

  elements.reservePolicyCard.innerHTML = `
    <div class="policy-card-head">
      <small>予約の考え方</small>
      <strong>${escapeHtml(clinic.name)}</strong>
    </div>
    <div class="policy-card-stack">
      <article class="policy-item">
        <span class="policy-icon">⏰</span>
        <div>
          <strong>1診療60分</strong>
          <p>空き枠は1時間単位で表示しています。</p>
        </div>
      </article>
      <article class="policy-item">
        <span class="policy-icon">🗓️</span>
        <div>
          <strong>空き枠から選択</strong>
          <p>予約可能な日時だけを一覧表示します。</p>
        </div>
      </article>
      <article class="policy-item">
        <span class="policy-icon">📞</span>
        <div>
          <strong>${escapeHtml(reservationChannels)}</strong>
          <p>急ぎの場合は電話連絡も案内しています。</p>
        </div>
      </article>
    </div>
  `;

  elements.availabilityMeta.innerHTML = `
    <span class="meta-pill">${state.availability.length}日分</span>
    <span class="meta-pill">${nextAvailableDay ? `${escapeHtml(nextAvailableDay.dateLabel)} に空きあり` : "空き枠を確認中"}</span>
  `;

  renderAvailabilityTabs();
  renderSlotGrid();
  renderAppointmentResult();
}

async function submitAppointment(event) {
  event.preventDefault();
  const selectedSlot = getSelectedSlot();
  if (!selectedSlot) {
    throw new Error("予約したい空き枠を先に選んでください。");
  }

  const formData = new FormData(elements.appointmentForm);
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const visitType = String(formData.get("visitType") || "初診");
  const chiefComplaint = String(formData.get("chiefComplaint") || "").trim();
  const concernArea = String(formData.get("concernArea") || "").trim();
  const patientRequest = String(formData.get("patientRequest") || "").trim();
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
      preferredDate: createIsoAt(date, time),
      preferredTime: time,
      visitType,
      reason: [chiefComplaint, concernArea].filter(Boolean).join(" / ") || notes || "相談内容未入力",
      chiefComplaint,
      concernArea,
      patientRequest,
      notes,
      consultationNotes: notes,
      firstVisit: visitType === "初診"
    })
  });

  state.bootstrap = {
    ...state.bootstrap,
    appointments: response.appointments,
    patients: response.patients
  };
  state.availability = buildAvailability(state.bootstrap);
  state.lastAppointmentResult = {
    appointment: response.appointment,
    patient: response.patient
  };
  state.selectedSlotKey = "";
  const nextAvailable = getFirstAvailableSlot();
  if (nextAvailable) {
    state.selectedDayIndex = state.availability.findIndex((day) => day.dateKey === nextAvailable.dateKey);
    state.selectedSlotKey = nextAvailable.key;
    setHiddenSlotFields(nextAvailable);
  } else {
    setHiddenSlotFields(null);
  }
  renderPage();
}

async function init() {
  state.bootstrap = await apiFetch("/api/bootstrap");
  state.availability = buildAvailability(state.bootstrap);
  const initialSlot = getFirstAvailableSlot();
  if (initialSlot) {
    state.selectedDayIndex = state.availability.findIndex((day) => day.dateKey === initialSlot.dateKey);
    state.selectedSlotKey = initialSlot.key;
  }
  setHiddenSlotFields(initialSlot);
  renderPage();

  elements.resetAppointmentForm.addEventListener("click", () => {
    elements.appointmentForm.reset();
    state.lastAppointmentResult = null;
    const slot = getFirstAvailableSlot();
    if (slot) {
      state.selectedDayIndex = state.availability.findIndex((day) => day.dateKey === slot.dateKey);
      state.selectedSlotKey = slot.key;
      setHiddenSlotFields(slot);
    } else {
      state.selectedSlotKey = "";
      setHiddenSlotFields(null);
    }
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
  setMessage(elements.appointmentFeedback, "error", error.message);
});
