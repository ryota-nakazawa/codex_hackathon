const { sanitizeText } = require("./validation");

const SIGNALS = [
  { key: "疼痛", terms: ["痛み", "疼痛", "しみる", "冷水痛", "温痛"] },
  { key: "歯周", terms: ["歯周", "ポケット", "動揺", "出血", "腫れ", "腫脹"] },
  { key: "う蝕", terms: ["う蝕", "虫歯", "カリエス"] },
  { key: "補綴", terms: ["被せ", "補綴", "クラウン", "ブリッジ", "詰め物"] },
  { key: "根管", terms: ["根管", "根尖", "根の先"] },
  { key: "咬合", terms: ["噛む", "咬合", "かみ合わせ"] },
  { key: "審美", terms: ["見た目", "審美", "白く", "前歯"] },
  { key: "不安", terms: ["不安", "怖い", "心配"] }
];

function extractSignals(text) {
  const source = sanitizeText(text).toLowerCase();
  return SIGNALS.filter((signal) => signal.terms.some((term) => source.includes(term.toLowerCase()))).map(
    (signal) => signal.key
  );
}

function buildCombinedSignalSummary(signals) {
  if (!signals.length) {
    return "症状、既往処置、優先度を横断して整理が必要です";
  }
  if (signals.length === 1) {
    return `${signals[0]} を中心に確認が必要です`;
  }
  return `${signals.slice(0, 2).join(" と ")} を中心に確認が必要です`;
}

function buildContext(input) {
  const hasImage = Boolean(input.image);
  const interview = input.patientInterview || {};
  const analysisContext = input.analysisContext || {};
  const reservation = analysisContext.latestAppointment || {};
  const textSource = [
    input.chartNotes,
    input.patientRequest,
    interview.chiefComplaint,
    interview.symptoms,
    interview.patientRequest,
    interview.notes,
    analysisContext.chiefComplaint,
    analysisContext.concernArea,
    analysisContext.patientRequest,
    analysisContext.consultationNotes,
    reservation.chiefComplaint,
    reservation.concernArea,
    reservation.patientRequest,
    reservation.consultationNotes
  ]
    .filter(Boolean)
    .join(" ");
  const hasText = Boolean(textSource);
  const signals = extractSignals(textSource);
  const hasReservationContext = Boolean(
    analysisContext.chiefComplaint ||
      analysisContext.concernArea ||
      analysisContext.patientRequest ||
      analysisContext.consultationNotes ||
      reservation.chiefComplaint ||
      reservation.concernArea ||
      reservation.patientRequest ||
      reservation.consultationNotes
  );

  return {
    hasImage,
    hasText,
    hasReservationContext,
    signals,
    signalSummary: buildCombinedSignalSummary(signals),
    patientLabel: input.patientId || input.caseId || "未設定症例",
    analysisContext,
    interview
  };
}

function buildQuickOverview(context) {
  const interview = context.interview || {};
  const analysisContext = context.analysisContext || {};
  const reservation = analysisContext.latestAppointment || {};
  const chiefComplaint = interview.chiefComplaint || analysisContext.chiefComplaint || reservation.chiefComplaint || "";
  const concernArea = interview.concernArea || analysisContext.concernArea || reservation.concernArea || "";
  const patientRequest = interview.patientRequest || analysisContext.patientRequest || reservation.patientRequest || "";

  const highlights = [
    chiefComplaint || "主訴未設定",
    concernArea || "疾患部未設定",
    patientRequest || "患者要望未入力"
  ];

  if (context.hasImage) {
    highlights.push("レントゲン画像あり");
  }
  if (context.hasText) {
    highlights.push("ヒアリング情報あり");
  }

  return {
    title: context.signalSummary,
    summary: context.hasImage && context.hasText && context.hasReservationContext
      ? `予約時の情報、ヒアリング、レントゲン画像を合わせると、${context.signalSummary}。`
      : context.hasImage && context.hasText
        ? `ヒアリングとレントゲン画像を合わせると、${context.signalSummary}。`
        : context.hasText && context.hasReservationContext
          ? `予約時の情報とヒアリングから、${context.signalSummary}。`
          : context.hasText
            ? `テキスト入力から、${context.signalSummary}。`
        : "レントゲン画像のみが入力されています。",
    highlights,
    contextTags: [chiefComplaint, concernArea, patientRequest].filter(Boolean)
  };
}

function buildChecklist(context) {
  const items = [];
  const interview = context.interview || {};
  const analysisContext = context.analysisContext || {};
  const reservation = analysisContext.latestAppointment || {};
  const chiefComplaint = interview.chiefComplaint || analysisContext.chiefComplaint || reservation.chiefComplaint || "";
  const concernArea = interview.concernArea || analysisContext.concernArea || reservation.concernArea || "";
  const patientRequest = interview.patientRequest || analysisContext.patientRequest || reservation.patientRequest || "";
  const consultationNotes = analysisContext.consultationNotes || reservation.consultationNotes || "";

  if (context.hasText) {
    items.push(`主訴「${chiefComplaint || "未設定"}」と疾患部「${concernArea || "未設定"}」が一致しているか確認する。`);
    items.push("既往処置、服薬、アレルギー、来院理由の優先順位を再確認する。");
    items.push(`患者要望${patientRequest ? `「${patientRequest}」` : "の有無"}を、疼痛緩和・審美・機能回復のどれに近いか整理する。`);
    if (consultationNotes) {
      items.push("予約時の相談メモとヒアリング内容の差分を確認する。");
    }
  }

  if (context.hasImage) {
    items.push("画像で気になる部位の位置、左右差、既往修復物周囲の変化を確認する。");
    items.push("根尖部、歯周支持組織、埋伏歯や補綴下の異常示唆がないかを診察所見と照合する。");
    items.push("必要に応じて追加撮影や口腔内所見で裏取りする。");
  }

  if (!items.length) {
    items.push("入力情報が不足しているため、症例情報を追加してください。");
  }

  return items;
}

function buildExplanation(context) {
  const interview = context.interview || {};
  const analysisContext = context.analysisContext || {};
  const reservation = analysisContext.latestAppointment || {};
  const chiefComplaint = interview.chiefComplaint || analysisContext.chiefComplaint || reservation.chiefComplaint || "";
  const concernArea = interview.concernArea || analysisContext.concernArea || reservation.concernArea || "";
  const patientRequest = interview.patientRequest || analysisContext.patientRequest || reservation.patientRequest || "";

  if (context.hasImage && context.hasText) {
    return {
      clinician: "予約時の主訴・疾患部・相談内容とレントゲン画像を合わせて、気になる点を整理しています。必要な検査や治療方針は先生が診察所見を踏まえて最終判断してください。",
      patient: `現在の情報からは、${[chiefComplaint, concernArea, patientRequest].filter(Boolean).join(" / ")} を中心に確認しています。ここから先は先生が実際のお口の状態と合わせて確認し、必要な検査や治療の選択肢を決めます。`
    };
  }
  if (context.hasText) {
    return {
      clinician: "現時点では主に予約時の情報とヒアリングをもとに整理しています。画像確認前のため、場所や原因は断定せず、症状の経過と優先したいことを中心に説明する前提です。",
      patient: `今ある情報では、${[chiefComplaint, concernArea, patientRequest].filter(Boolean).join(" / ")} を中心に確認しています。必要な検査は先生が診察時に判断します。`
    };
  }
  return {
    clinician: "現時点では画像から見て気になる部分を整理する段階です。症状の感じ方や生活背景がまだ分からないため、原因や治療内容はこの場で断定せず、先生が問診と診察を合わせて最終判断してください。",
    patient: "現時点では画像を見て気になる部分を整理しています。症状の感じ方や生活背景がまだ分からないため、原因や治療内容はこの場で断定しません。"
  };
}

function buildReferencePoints(context) {
  const items = [
    "AI出力は診断確定ではなく、確認漏れ防止と患者説明準備の補助として扱う。",
    "患者説明では、画像で見える点と問診から分かる点を混同しない。",
    "治療方針は必ず歯科医師が臨床所見を踏まえて決定する。"
  ];

  if (context.hasImage && !context.hasText) {
    items.push("画像のみ入力のため、疼痛の程度、既往歴、患者希望は別途確認が必要。");
  }

  if (context.hasText && !context.hasImage) {
    items.push("テキストのみ入力のため、画像由来の示唆や部位断定は出さない。");
  }

  return items;
}

function buildDisclaimer(context) {
  const items = [
    "本出力は診断補助と情報整理を目的としています。",
    "診断確定、治療方針の決定、投薬判断は行いません。",
    "最終判断は必ず歯科医師が実施してください。"
  ];

  if (context.hasImage && !context.hasText) {
    items.push("画像のみ入力では患者背景に依存する説明を避けてください。");
  }

  if (context.hasText && !context.hasImage) {
    items.push("テキストのみ入力では画像由来の所見や注目領域を断定しません。");
  }

  return items;
}

function buildMarkdown(report) {
  const section = report.sections;
  return [
    `# 補助レポート`,
    "",
    `- 生成経路: ${report.meta.modeUsed}`,
    `- 生成時刻: ${report.meta.generatedAt}`,
    `- 対象: ${report.meta.patientLabel}`,
    "",
    "## Quick Overview",
    section.quickOverview.summary,
    ...section.quickOverview.highlights.map((item) => `- ${item}`),
    "",
    "## Checklist",
    ...section.checklist.map((item) => `- ${item}`),
    "",
    "## Explanation",
    section.explanation.patient,
    "",
    "## 参考観点",
    ...section.referencePoints.map((item) => `- ${item}`),
    "",
    "## 注意事項",
    ...section.disclaimer.map((item) => `- ${item}`)
  ].join("\n");
}

function createReport(input, modeUsed, generator, warnings = []) {
  const context = buildContext(input);
  const quickOverview = buildQuickOverview(context);
  const checklist = buildChecklist(context);
  const explanation = buildExplanation(context);
  const referencePoints = buildReferencePoints(context);
  const disclaimer = buildDisclaimer(context);
  const report = {
    meta: {
      requestedMode: input.mode,
      modeUsed,
      generator,
      generatedAt: new Date().toISOString(),
      patientLabel: context.patientLabel,
      inputSummary: {
        hasImage: context.hasImage,
        hasTextInputs: context.hasText,
        hasChartNotes: Boolean(input.chartNotes),
        hasPatientRequest: Boolean(input.patientRequest),
        hasInterview: Boolean(input.patientInterview && Object.values(input.patientInterview).some(Boolean)),
        hasReservationContext: Boolean(input.analysisContext && Object.keys(input.analysisContext).length)
      },
      constraintFlags: {
        avoidImageDerivedSuggestions: !context.hasImage,
        avoidBackgroundClaims: !context.hasText,
        requiresClinicianReview: true
      },
      warnings,
      analysisContext: input.analysisContext || {}
    },
    sections: {
      quickOverview,
      checklist,
      explanation,
      referencePoints,
      disclaimer,
      summary: quickOverview.summary,
      checkpoints: checklist,
      patientExplanation: explanation.patient
    }
  };

  report.markdown = buildMarkdown(report);
  return report;
}

function createMockReport(input) {
  return createReport(input, "mock", "mock-template-v1");
}

function createFallbackReport(input, warnings = []) {
  return createReport(input, "fallback", "fallback-rules-v1", warnings);
}

module.exports = {
  createFallbackReport,
  createMockReport
};
