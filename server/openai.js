const { config } = require("./config");
const { createValidationError, sanitizeText } = require("./validation");

const SYSTEM_PROMPT = [
  "あなたは歯科診療向けの情報整理支援AIです。",
  "役割は診断補助と患者説明準備に限定し、診断確定や治療方針の自動決定はしません。",
  "最終判断は歯科医師が行う前提で、断定を避けた日本語のJSONのみを返してください。",
  "画像がない場合は画像由来の所見や注目領域を断定しないでください。",
  "背景情報がない場合は患者背景や希望に依存する説明を断定しないでください。"
].join(" ");

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quickOverview", "checklist", "explanation", "referencePoints", "disclaimer"],
  properties: {
    quickOverview: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "highlights"],
      properties: {
        summary: { type: "string" },
        highlights: {
          type: "array",
          items: { type: "string" },
          maxItems: 6
        },
        contextTags: {
          type: "array",
          items: { type: "string" },
          maxItems: 6
        }
      }
    },
    checklist: {
      type: "array",
      items: { type: "string" },
      maxItems: 8
    },
    explanation: {
      type: "object",
      additionalProperties: false,
      required: ["clinician", "patient"],
      properties: {
        clinician: { type: "string" },
        patient: { type: "string" }
      }
    },
    referencePoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8
    },
    disclaimer: {
      type: "array",
      items: { type: "string" },
      maxItems: 6
    }
  }
};

function buildLivePrompt(input) {
  const analysisContext = input.analysisContext || {};
  const reservation = analysisContext.latestAppointment || {};
  const noteBlock = input.chartNotes ? `カルテ要点:\n${sanitizeText(input.chartNotes)}` : "カルテ要点: 未入力";
  const requestBlock = input.patientRequest
    ? `患者要望:\n${sanitizeText(input.patientRequest)}`
    : "患者要望: 未入力";
  const interview = input.patientInterview || {};
  const interviewLines = [
    interview.chiefComplaint && `主訴: ${sanitizeText(interview.chiefComplaint)}`,
    interview.concernArea && `疾患部: ${sanitizeText(interview.concernArea)}`,
    interview.symptoms && `症状: ${sanitizeText(interview.symptoms)}`,
    interview.onset && `開始時期: ${sanitizeText(interview.onset)}`,
    interview.aggravatingFactors && `増悪条件: ${sanitizeText(interview.aggravatingFactors)}`,
    interview.relievingFactors && `軽減条件: ${sanitizeText(interview.relievingFactors)}`,
    interview.priorTreatment && `既往治療: ${sanitizeText(interview.priorTreatment)}`,
    interview.patientRequest && `要望: ${sanitizeText(interview.patientRequest)}`,
    interview.notes && `補足: ${sanitizeText(interview.notes)}`,
    analysisContext.chiefComplaint && `予約時主訴: ${sanitizeText(analysisContext.chiefComplaint)}`,
    analysisContext.concernArea && `予約時疾患部: ${sanitizeText(analysisContext.concernArea)}`,
    analysisContext.patientRequest && `予約時要望: ${sanitizeText(analysisContext.patientRequest)}`,
    analysisContext.consultationNotes && `予約時相談メモ: ${sanitizeText(analysisContext.consultationNotes)}`,
    reservation.chiefComplaint && `最新予約主訴: ${sanitizeText(reservation.chiefComplaint)}`,
    reservation.concernArea && `最新予約疾患部: ${sanitizeText(reservation.concernArea)}`,
    reservation.patientRequest && `最新予約要望: ${sanitizeText(reservation.patientRequest)}`,
    reservation.consultationNotes && `最新予約相談メモ: ${sanitizeText(reservation.consultationNotes)}`
  ].filter(Boolean);
  const interviewBlock = interviewLines.length ? `ヒアリング:\n${interviewLines.join("\n")}` : "ヒアリング: 未入力";

  return [
    "あなたは歯科診療向けの診断補助AIです。",
    "必ず診断補助と情報整理に限定し、診断確定や治療方針の自動決定をしないでください。",
    "JSONのみを返してください。",
    "返却JSONの形式:",
    '{ "quickOverview": { "summary": "string", "highlights": ["string"], "contextTags": ["string"] }, "checklist": ["string"], "explanation": { "clinician": "string", "patient": "string" }, "referencePoints": ["string"], "disclaimer": ["string"] }',
    "制約:",
    "- 画像のみ入力時は患者背景に依存する説明を断定しない",
    "- テキストのみ入力時は画像由来の所見や注目領域を断定しない",
    "- すべて日本語で返す",
    "",
    `患者ID: ${input.patientId ? "提供あり" : "未入力"}`,
    `症例ID: ${input.caseId ? "提供あり" : "未入力"}`,
    interviewBlock,
    noteBlock,
    "",
    requestBlock
  ].join("\n");
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    const texts = [];
    for (const outputItem of data.output) {
      if (!Array.isArray(outputItem.content)) {
        continue;
      }
      for (const content of outputItem.content) {
        if (content.type === "output_text" && typeof content.text === "string") {
          texts.push(content.text);
        }
      }
    }
    if (texts.length) {
      return texts.join("\n");
    }
  }

  return "";
}

function parseJsonPayload(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("JSON response not found");
}

function normalizeLiveReport(report) {
  if (!report || typeof report !== "object") {
    throw createValidationError("モデル応答が不正です。", 502);
  }

  const quickOverview = report.quickOverview && typeof report.quickOverview === "object" ? report.quickOverview : {};
  const checklist = Array.isArray(report.checklist) ? report.checklist.map(sanitizeText).filter(Boolean) : [];
  const explanation = report.explanation && typeof report.explanation === "object" ? report.explanation : {};

  return {
    quickOverview: {
      summary: sanitizeText(quickOverview.summary || report.summary || ""),
      highlights: Array.isArray(quickOverview.highlights) ? quickOverview.highlights.map(sanitizeText).filter(Boolean) : [],
      contextTags: Array.isArray(quickOverview.contextTags) ? quickOverview.contextTags.map(sanitizeText).filter(Boolean) : []
    },
    checklist,
    explanation: {
      clinician: sanitizeText(explanation.clinician || ""),
      patient: sanitizeText(explanation.patient || report.patientExplanation || "")
    },
    summary: sanitizeText(quickOverview.summary || report.summary || ""),
    checkpoints: checklist,
    patientExplanation: sanitizeText(explanation.patient || report.patientExplanation || ""),
    referencePoints: Array.isArray(report.referencePoints) ? report.referencePoints.map(sanitizeText).filter(Boolean) : [],
    disclaimer: Array.isArray(report.disclaimer)
      ? report.disclaimer.map(sanitizeText).filter(Boolean)
      : ["本出力は診断補助用途に限定し、最終判断は歯科医師が実施してください。"]
  };
}

async function generateLiveReport(input) {
  if (!config.openai.apiKey) {
    throw createValidationError("OPENAI_API_KEY が未設定です。", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  const content = [{ type: "input_text", text: buildLivePrompt(input) }];
  if (input.image) {
    content.push({
      type: "input_image",
      image_url: input.image.dataUrl
    });
  }

  try {
    const response = await fetch(`${config.openai.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: config.openai.model,
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }]
          },
          {
            role: "user",
            content
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "dental_support_report",
            strict: true,
            schema: REPORT_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = sanitizeText(data.error && data.error.message ? data.error.message : "モデル呼び出しに失敗しました。");
      throw createValidationError(message, 502);
    }

    const outputText = extractResponseText(data);
    const parsed = parseJsonPayload(outputText);
    return normalizeLiveReport(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateLiveReport
};
