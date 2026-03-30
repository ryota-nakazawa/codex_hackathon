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
  const hasText = Boolean(input.chartNotes || input.patientRequest);
  const signals = extractSignals(`${input.chartNotes} ${input.patientRequest}`);

  return {
    hasImage,
    hasText,
    signals,
    signalSummary: buildCombinedSignalSummary(signals),
    patientLabel: input.patientId || input.caseId || "未設定症例"
  };
}

function buildSummary(context) {
  if (context.hasImage && context.hasText) {
    return `患者要望・カルテ要点・画像情報を合わせると、${context.signalSummary}。画像由来の示唆と問診由来の背景情報を切り分けつつ、最終判断前の整理に使う前提です。`;
  }
  if (context.hasText) {
    return `テキスト入力から、${context.signalSummary}。画像情報がないため、部位や骨・歯根周囲の評価は診察時に追加確認してください。`;
  }
  return "レントゲン画像のみが入力されています。画像上で気になる部位や左右差の有無は整理できますが、症状背景や患者要望は未反映のため断定は避ける前提です。";
}

function buildCheckpoints(context) {
  const items = [];

  if (context.hasText) {
    items.push("主訴の部位、誘因、持続時間がカルテ要点と一致しているか確認する。");
    items.push("既往処置、服薬、アレルギー、来院理由の優先順位を再確認する。");
    items.push("患者要望が、疼痛緩和・審美・機能回復のどれに近いかを明確にする。");
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

function buildPatientExplanation(context) {
  if (context.hasImage && context.hasText) {
    return "現在ある情報をもとに、症状の背景と画像で気になる点を整理しています。ここから先は先生が実際のお口の状態と合わせて確認し、必要な検査や治療の選択肢を最終判断します。ご説明では、気になる場所、考えられる原因、次に確認する内容を順番にお伝えしやすい形にしています。";
  }
  if (context.hasText) {
    return "現時点では主に問診やカルテ要点をもとに整理しています。画像確認前のため、場所や原因は断定せず、症状の経過と優先したいことを中心に説明する前提です。必要な検査は先生が診察時に判断します。";
  }
  return "現時点では画像から見て気になる部分を整理する段階です。症状の感じ方や生活背景がまだ分からないため、原因や治療内容はこの場で断定せず、先生が問診と診察を合わせて最終判断します。";
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
    "## 要約",
    section.summary,
    "",
    "## 要確認ポイント",
    ...section.checkpoints.map((item) => `- ${item}`),
    "",
    "## 患者説明文案",
    section.patientExplanation,
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
        hasPatientRequest: Boolean(input.patientRequest)
      },
      constraintFlags: {
        avoidImageDerivedSuggestions: !context.hasImage,
        avoidBackgroundClaims: !context.hasText,
        requiresClinicianReview: true
      },
      warnings
    },
    sections: {
      summary: buildSummary(context),
      checkpoints: buildCheckpoints(context),
      patientExplanation: buildPatientExplanation(context),
      referencePoints: buildReferencePoints(context),
      disclaimer: buildDisclaimer(context)
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
