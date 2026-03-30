const fs = require("fs");
const path = require("path");

const { createFallbackReport } = require("./report-generators");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toIsoFromDateTime(date, time = "09:30") {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const groupKey = item[key];
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function mapBootstrapToState() {
  const bootstrap = readJson("bootstrap.json");
  const site = readJson("site.json");
  const patientSummaries = readJson("patients.json");
  const appointmentRows = readJson("appointments.json");
  const patientDetails = readJson("patient-details.json");

  const bootstrapPatientMap = Object.fromEntries((bootstrap.patients || []).map((patient) => [patient.id, patient]));
  const reportsByPatient = groupBy(bootstrap.reports || [], "patientId");
  const xraysByPatient = groupBy(bootstrap.xrayImages || [], "patientId");

  const patients = {};
  for (const summary of patientSummaries) {
    const detail = patientDetails[summary.id] || {};
    const bootstrapPatient = bootstrapPatientMap[summary.id] || {};
    const reports = (reportsByPatient[summary.id] || []).map((report) => ({
      id: report.id,
      createdAt: report.createdAt,
      title: `診断補助レポート ${report.id}`,
      summary: report.summary,
      checkpoints: report.checkpoints || [],
      patientExplanation: report.patientExplanation || "",
      referencePoints: report.referencePoints || [],
      disclaimer: [
        "本出力は診断補助用途に限定します。",
        "最終判断は歯科医師が実施してください。"
      ],
      xrayStudyId: (detail.xrayIds || [])[0] || ""
    }));

    const xrayStudies = (xraysByPatient[summary.id] || []).map((xray) => ({
      id: xray.id,
      takenAt: xray.takenAt,
      fileName: xray.fileName,
      mimeType: xray.mimeType,
      bodyPart: xray.bodyPart,
      view: xray.view,
      storageHint: xray.storageHint,
      meta: xray.meta,
      reportSummary: xray.reportSummary,
      findingHints: xray.findingHints || []
    }));

    patients[summary.id] = {
      id: summary.id,
      patientNo: summary.patientNumber,
      patientNumber: summary.patientNumber,
      name: summary.name,
      kana: summary.kana,
      sex: summary.sex || detail.profile?.sex || "",
      birthYear: summary.birthYear || detail.profile?.birthYear || "",
      birthDate: "",
      phone: summary.phone || bootstrapPatient.phone || "",
      email: bootstrapPatient.email || "",
      address: "",
      status: summary.status || bootstrapPatient.status || "登録済み",
      source: "seed",
      tags: detail.tags || [],
      mainConcern: summary.mainConcern || bootstrapPatient.mainConcern || "",
      chiefComplaint: summary.mainConcern || bootstrapPatient.mainConcern || "",
      notes: bootstrapPatient.notes || "",
      allergies: Array.isArray(bootstrapPatient.allergies) ? bootstrapPatient.allergies.join("、") : "",
      firstVisitAt: bootstrapPatient.firstVisit || "",
      lastVisitAt: summary.lastVisit ? `${summary.lastVisit}T09:00:00+09:00` : "",
      nextAppointmentAt: "",
      appointments: [],
      history: detail.history || [],
      reports,
      xrayStudies
    };
  }

  const appointments = appointmentRows.map((appointment) => {
    const scheduledAt = toIsoFromDateTime(appointment.date, appointment.time);
    if (patients[appointment.patientId]) {
      patients[appointment.patientId].appointments.push(appointment.id);
      patients[appointment.patientId].nextAppointmentAt = scheduledAt;
    }

    return {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      kana: patients[appointment.patientId]?.kana || "",
      phone: patients[appointment.patientId]?.phone || "",
      email: patients[appointment.patientId]?.email || "",
      scheduledAt,
      durationMinutes: 30,
      visitType: appointment.type,
      status: appointment.status,
      doctorName: appointment.doctor,
      room: "未定",
      reason: appointment.reason,
      notes: appointment.memo,
      channel: appointment.channel || "web",
      firstVisit: appointment.type === "初診"
    };
  });

  return {
    clinic: {
      id: bootstrap.clinic.id,
      name: bootstrap.clinic.name,
      tagline: bootstrap.clinic.tagline,
      phone: bootstrap.clinic.phone,
      address: bootstrap.clinic.address,
      hours: bootstrap.clinic.hours,
      services: bootstrap.clinic.services,
      reservation: bootstrap.clinic.reservation,
      heroTitle: site.site.headline,
      heroLead: site.site.description,
      highlights: [
        "初診・再診の予約導線を分けて迷いにくく設計",
        "予約後は院内ダッシュボードに一覧反映",
        "患者詳細では過去レポートとレントゲン情報を同時確認"
      ],
      bookingFlow: [
        "サイトトップから予約フォームへ",
        "初診/再診と希望日時を入力",
        "予約受付後に院内一覧へ反映"
      ],
      faq: [
        {
          question: "初診でもWEB予約できますか",
          answer: "はい。初診/再診を選び、主訴と希望日時を入力して送信できます。"
        },
        {
          question: "急ぎの痛みがある場合はどうすればいいですか",
          answer: "WEB予約送信後の確認を待たず、電話連絡を優先してください。"
        }
      ]
    },
    site: site.site,
    siteSections: site.sections,
    bookingForm: {
      ...site.bookingForm,
      preferredTimeOptions: ["09:30", "10:30", "11:30", "14:30", "15:30", "16:30", "17:30"]
    },
    dashboard: {
      tabs: ["予約一覧", "患者一覧", "患者詳細", "新規患者登録"],
      quickActions: ["予約確認", "患者詳細へ", "新規患者登録", "過去レポート確認"]
    },
    patients,
    appointments
  };
}

function summarizePatient(patient) {
  return {
    id: patient.id,
    patientNumber: patient.patientNumber || patient.patientNo || "",
    name: patient.name,
    kana: patient.kana,
    phone: patient.phone,
    status: patient.status,
    mainConcern: patient.mainConcern || patient.chiefComplaint || "",
    lastVisitAt: patient.lastVisitAt || "",
    nextAppointmentAt: patient.nextAppointmentAt || "",
    tags: patient.tags || []
  };
}

function summarizeAppointment(appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    scheduledAt: appointment.scheduledAt,
    durationMinutes: appointment.durationMinutes,
    visitType: appointment.visitType,
    status: appointment.status,
    doctorName: appointment.doctorName,
    reason: appointment.reason,
    channel: appointment.channel || "web"
  };
}

function createClinicStore(seedData = mapBootstrapToState()) {
  const state = deepClone(seedData);
  let patientSequence = Object.keys(state.patients).length + 1;
  let appointmentSequence = state.appointments.length + 111;
  let reportSequence = 1;
  let xraySequence = Object.values(state.patients).reduce((total, patient) => total + (patient.xrayStudies || []).length, 0) + 1;

  function nextPatientId() {
    const id = `p-${String(patientSequence).padStart(3, "0")}`;
    patientSequence += 1;
    return id;
  }

  function nextPatientNumber() {
    return `A-${String(332 + patientSequence).padStart(4, "0")}`;
  }

  function nextAppointmentId() {
    const id = `apt-${String(appointmentSequence).padStart(3, "0")}`;
    appointmentSequence += 1;
    return id;
  }

  function nextReportId() {
    const id = `rep-runtime-${String(reportSequence).padStart(3, "0")}`;
    reportSequence += 1;
    return id;
  }

  function nextXrayStudyId() {
    const id = `xr-runtime-${String(xraySequence).padStart(3, "0")}`;
    xraySequence += 1;
    return id;
  }

  function getPatientRecord(patientId) {
    return state.patients[patientId] || null;
  }

  function listPatients() {
    return Object.values(state.patients)
      .map((patient) => summarizePatient(patient))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  function listAppointments() {
    return state.appointments
      .map((appointment) => summarizeAppointment(appointment))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  function getPatientDetail(patientId) {
    const patient = getPatientRecord(patientId);
    if (!patient) {
      return null;
    }

    const appointments = state.appointments
      .filter((appointment) => appointment.patientId === patientId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    const reports = (patient.reports || []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      patient: deepClone(patient),
      appointments: deepClone(appointments),
      reports: deepClone(reports),
      xrayStudies: deepClone(patient.xrayStudies || []),
      latestReport: deepClone(reports[0] || null)
    };
  }

  function createPatient(payload, source = "manual") {
    const id = nextPatientId();
    const patientNumber = nextPatientNumber();
    const patient = {
      id,
      patientNo: patientNumber,
      patientNumber,
      name: payload.name,
      kana: payload.kana || "",
      sex: payload.sex || "",
      birthYear: payload.birthDate ? String(payload.birthDate).slice(0, 4) : "",
      birthDate: payload.birthDate || "",
      phone: payload.phone || "",
      email: payload.email || "",
      address: payload.address || "",
      status: source === "web-reservation" ? "新規予約" : "登録済み",
      source,
      tags: [],
      mainConcern: payload.chiefComplaint || "",
      chiefComplaint: payload.chiefComplaint || "",
      notes: payload.notes || "",
      allergies: payload.allergies || "",
      firstVisitAt: "",
      lastVisitAt: "",
      nextAppointmentAt: "",
      appointments: [],
      history: [],
      reports: [],
      xrayStudies: []
    };

    state.patients[id] = patient;
    return deepClone(patient);
  }

  function createAppointment(payload) {
    let patient = null;
    if (payload.patientId) {
      patient = getPatientRecord(payload.patientId);
      if (!patient) {
        return { error: "指定された患者IDが見つかりません。", statusCode: 404 };
      }
    } else {
      const created = createPatient(
        {
          name: payload.patientName,
          kana: payload.kana,
          phone: payload.phone,
          email: payload.email,
          notes: payload.notes,
          chiefComplaint: payload.reason
        },
        "web-reservation"
      );
      patient = getPatientRecord(created.id);
    }

    const appointment = {
      id: nextAppointmentId(),
      patientId: patient.id,
      patientName: patient.name,
      kana: patient.kana,
      phone: payload.phone || patient.phone || "",
      email: payload.email || patient.email || "",
      scheduledAt: payload.preferredDate,
      durationMinutes: 30,
      visitType: payload.visitType || "初診",
      status: "confirmed",
      doctorName: "未定",
      room: "未定",
      reason: payload.reason || "",
      notes: payload.notes || "",
      channel: "web",
      firstVisit: payload.firstVisit
    };

    state.appointments.push(appointment);
    patient.appointments.push(appointment.id);
    patient.nextAppointmentAt = appointment.scheduledAt;
    if (!patient.status || patient.status === "登録済み") {
      patient.status = appointment.firstVisit ? "新規予約" : "再診予約";
    }
    if (!patient.mainConcern && appointment.reason) {
      patient.mainConcern = appointment.reason;
      patient.chiefComplaint = appointment.reason;
    }

    return {
      appointment: deepClone(appointment),
      patient: summarizePatient(patient)
    };
  }

  function addDiagnosticReport(patientId, input) {
    const patient = getPatientRecord(patientId);
    if (!patient) {
      return null;
    }

    const generated = createFallbackReport({
      mode: "fallback",
      patientId,
      caseId: `CASE-${patientId}`,
      patientRequest: patient.mainConcern || "",
      chartNotes: input.body || ""
    });

    const record = {
      id: nextReportId(),
      createdAt: new Date().toISOString(),
      title: input.title || "診断補助レポート",
      summary: generated.sections.summary,
      checkpoints: generated.sections.checkpoints,
      patientExplanation: generated.sections.patientExplanation,
      referencePoints: generated.sections.referencePoints,
      disclaimer: generated.sections.disclaimer,
      xrayStudyId: (patient.xrayStudies[0] && patient.xrayStudies[0].id) || ""
    };

    patient.reports.unshift(record);
    return deepClone(record);
  }

  function addXrayAnalysis(patientId, input, generated) {
    const patient = getPatientRecord(patientId);
    if (!patient) {
      return null;
    }

    const now = new Date().toISOString();
    const xrayStudy = {
      id: nextXrayStudyId(),
      takenAt: now,
      fileName: input.image.name,
      mimeType: input.image.type,
      bodyPart: input.bodyPart || "未設定",
      view: input.view || "未設定",
      storageHint: "uploaded",
      meta: {
        size: input.image.size,
        analysisMode: generated.meta.modeUsed,
        requestedMode: generated.meta.requestedMode,
        generatedAt: generated.meta.generatedAt
      },
      reportSummary: generated.sections.summary,
      findingHints: generated.sections.checkpoints || []
    };

    const report = {
      id: nextReportId(),
      createdAt: now,
      title: "レントゲンAI解析レポート",
      summary: generated.sections.summary,
      checkpoints: generated.sections.checkpoints,
      patientExplanation: generated.sections.patientExplanation,
      referencePoints: generated.sections.referencePoints,
      disclaimer: generated.sections.disclaimer,
      xrayStudyId: xrayStudy.id
    };

    patient.xrayStudies.unshift(xrayStudy);
    patient.reports.unshift(report);
    patient.history.unshift({
      date: now.slice(0, 10),
      type: "レントゲンAI解析",
      doctor: "AI補助",
      summary: generated.sections.summary
    });

    return {
      xrayStudy: deepClone(xrayStudy),
      report: deepClone(report)
    };
  }

  function getBootstrap() {
    const patients = listPatients();
    const appointments = listAppointments();
    const upcomingAppointments = appointments.filter((item) => item.status !== "完了");

    return {
      ok: true,
      clinic: deepClone(state.clinic),
      site: deepClone(state.site),
      siteSections: deepClone(state.siteSections),
      bookingForm: deepClone(state.bookingForm),
      dashboard: deepClone(state.dashboard),
      appointments,
      patients,
      stats: {
        totalPatients: patients.length,
        totalAppointments: appointments.length,
        upcomingAppointments: upcomingAppointments.length,
        reportCount: Object.values(state.patients).reduce((total, patient) => total + (patient.reports || []).length, 0)
      },
      featuredPatient: patients[0] ? getPatientDetail(patients[0].id) : null
    };
  }

  return {
    getBootstrap,
    listPatients,
    listAppointments,
    getPatientDetail,
    createPatient: (payload) => createPatient(payload, "manual"),
    createAppointment,
    addDiagnosticReport,
    addXrayAnalysis,
    getPatientRecord: (patientId) => deepClone(getPatientRecord(patientId))
  };
}

module.exports = {
  createClinicStore
};
