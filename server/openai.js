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
  required: ["summary", "checkpoints", "patientExplanation", "referencePoints", "disclaimer"],
  properties: {
    summary: { type: "string" },
    checkpoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8
    },
    patientExplanation: { type: "string" },
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
  const noteBlock = input.chartNotes ? `カルテ要点:\n${sanitizeText(input.chartNotes)}` : "カルテ要点: 未入力";
  const requestBlock = input.patientRequest
    ? `患者要望:\n${sanitizeText(input.patientRequest)}`
    : "患者要望: 未入力";

  return [
    "あなたは歯科診療向けの診断補助AIです。",
    "必ず診断補助と情報整理に限定し、診断確定や治療方針の自動決定をしないでください。",
    "JSONのみを返してください。",
    "返却JSONの形式:",
    '{ "summary": "string", "checkpoints": ["string"], "patientExplanation": "string", "referencePoints": ["string"], "disclaimer": ["string"] }',
    "制約:",
    "- 画像のみ入力時は患者背景に依存する説明を断定しない",
    "- テキストのみ入力時は画像由来の所見や注目領域を断定しない",
    "- すべて日本語で返す",
    "",
    `患者ID: ${input.patientId ? "提供あり" : "未入力"}`,
    `症例ID: ${input.caseId ? "提供あり" : "未入力"}`,
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

  return {
    summary: sanitizeText(report.summary),
    checkpoints: Array.isArray(report.checkpoints) ? report.checkpoints.map(sanitizeText).filter(Boolean) : [],
    patientExplanation: sanitizeText(report.patientExplanation),
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
