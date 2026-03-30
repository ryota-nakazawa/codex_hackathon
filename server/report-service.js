const { createFallbackReport, createMockReport } = require("./report-generators");
const { generateLiveReport } = require("./openai");

function buildMarkdown(report) {
  return [
    "# 補助レポート",
    "",
    `- 生成経路: ${report.meta.modeUsed}`,
    `- 生成時刻: ${report.meta.generatedAt}`,
    `- 対象: ${report.meta.patientLabel}`,
    "",
    "## 要約",
    report.sections.summary,
    "",
    "## 要確認ポイント",
    ...report.sections.checkpoints.map((item) => `- ${item}`),
    "",
    "## 患者説明文案",
    report.sections.patientExplanation,
    "",
    "## 参考観点",
    ...report.sections.referencePoints.map((item) => `- ${item}`),
    "",
    "## 注意事項",
    ...report.sections.disclaimer.map((item) => `- ${item}`)
  ].join("\n");
}

function wrapLiveReport(input, liveReport, warnings = []) {
  const report = {
    meta: {
      requestedMode: input.mode,
      modeUsed: "live",
      generator: "openai-live",
      generatedAt: new Date().toISOString(),
      patientLabel: input.patientId || input.caseId || "未設定症例",
      inputSummary: {
        hasImage: Boolean(input.image),
        hasTextInputs: Boolean(input.chartNotes || input.patientRequest),
        hasChartNotes: Boolean(input.chartNotes),
        hasPatientRequest: Boolean(input.patientRequest)
      },
      constraintFlags: {
        avoidImageDerivedSuggestions: !input.image,
        avoidBackgroundClaims: !(input.chartNotes || input.patientRequest),
        requiresClinicianReview: true
      },
      warnings
    },
    sections: {
      summary: liveReport.summary,
      checkpoints: liveReport.checkpoints,
      patientExplanation: liveReport.patientExplanation,
      referencePoints: liveReport.referencePoints,
      disclaimer: liveReport.disclaimer
    }
  };

  report.markdown = buildMarkdown(report);
  return report;
}

async function generateReport(input) {
  if (input.mode === "mock") {
    return createMockReport(input);
  }

  if (input.mode === "live") {
    try {
      const liveReport = await generateLiveReport(input);
      return wrapLiveReport(input, liveReport);
    } catch (error) {
      const warning = `live モードを利用できなかったため fallback に切り替えました: ${error.message}`;
      return createFallbackReport(input, [warning]);
    }
  }

  return createFallbackReport(input);
}

module.exports = {
  generateReport
};
