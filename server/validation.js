const { config } = require("./config");

const SAFE_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_PATTERN = /<[^>]*>/g;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

function sanitizeText(value) {
  return String(value || "")
    .replace(SAFE_TEXT_PATTERN, " ")
    .replace(TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value, label) {
  const text = sanitizeText(value);
  if (text.length > config.maxTextLength) {
    throw createValidationError(`${label} は ${config.maxTextLength} 文字以内で入力してください。`);
  }
  return text;
}

function createValidationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeOptionalText(value, maxLength, label) {
  const text = sanitizeText(value);
  if (!text) {
    return "";
  }
  if (text.length > maxLength) {
    throw createValidationError(`${label} は ${maxLength} 文字以内で入力してください。`);
  }
  return text;
}

function normalizeIdentifier(value, label, maxLength = 64) {
  const text = sanitizeText(value);
  if (!text) {
    throw createValidationError(`${label} は必須です。`);
  }
  if (text.length > maxLength) {
    throw createValidationError(`${label} は ${maxLength} 文字以内で入力してください。`);
  }
  if (!IDENTIFIER_PATTERN.test(text)) {
    throw createValidationError(`${label} は英数字、ハイフン、アンダースコアのみ使用できます。`);
  }
  return text;
}

function normalizeOptionalDateTime(value, label) {
  const text = sanitizeText(value);
  if (!text) {
    return "";
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    throw createValidationError(`${label} の日時形式が不正です。`);
  }
  return new Date(parsed).toISOString();
}

function normalizeOptionalBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return false;
}

function parseImage(image) {
  if (!image) {
    return null;
  }

  const type = sanitizeText(image.type);
  const name = sanitizeText(image.name) || "xray-image";
  const dataUrl = String(image.dataUrl || "");
  const size = Number.parseInt(String(image.size || "0"), 10);

  if (!config.allowedImageTypes.has(type)) {
    throw createValidationError("画像は PNG / JPEG / WebP のみ対応しています。");
  }

  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) {
    throw createValidationError("画像データ形式が不正です。");
  }

  const base64Payload = dataUrl.split(",")[1] || "";
  const estimatedBytes = Math.floor((base64Payload.length * 3) / 4);
  const actualSize = Number.isFinite(size) && size > 0 ? size : estimatedBytes;

  if (actualSize > config.maxImageBytes) {
    throw createValidationError(`画像サイズは ${Math.floor(config.maxImageBytes / (1024 * 1024))}MB 以下にしてください。`);
  }

  return {
    name,
    type,
    size: actualSize,
    dataUrl
  };
}

function validateXrayAnalysisPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError("リクエスト本文は JSON オブジェクトである必要があります。");
  }

  const mode = sanitizeText(payload.mode || "fallback").toLowerCase();
  if (!["mock", "live", "fallback"].includes(mode)) {
    throw createValidationError("mode は mock / live / fallback のいずれかにしてください。");
  }

  const image = parseImage(payload.image);
  if (!image) {
    throw createValidationError("レントゲン画像は必須です。");
  }

  return {
    mode,
    image,
    bodyPart: normalizeOptionalText(payload.bodyPart, 120, "撮影部位"),
    view: normalizeOptionalText(payload.view, 120, "撮影方向"),
    notes: normalizeOptionalText(payload.notes, 2000, "所見メモ")
  };
}

function validateGeneratePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError("リクエスト本文は JSON オブジェクトである必要があります。");
  }

  const mode = sanitizeText(payload.mode || "fallback").toLowerCase();
  if (!["mock", "live", "fallback"].includes(mode)) {
    throw createValidationError("mode は mock / live / fallback のいずれかにしてください。");
  }

  const patientId = limitText(payload.patientId || "", "患者ID");
  const caseId = limitText(payload.caseId || "", "症例ID");
  const patientRequest = limitText(payload.patientRequest || "", "患者要望");
  const chartNotes = limitText(payload.chartNotes || "", "カルテ要点メモ");
  const image = parseImage(payload.image);

  if (!patientRequest && !chartNotes && !image) {
    throw createValidationError("患者要望、カルテ要点メモ、レントゲン画像のいずれかを入力してください。");
  }

  return {
    mode,
    patientId,
    caseId,
    patientRequest,
    chartNotes,
    image
  };
}

function validatePatientPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError("リクエスト本文は JSON オブジェクトである必要があります。");
  }

  const name = normalizeOptionalText(payload.name, 120, "患者名");
  if (!name) {
    throw createValidationError("患者名は必須です。");
  }

  return {
    name,
    kana: normalizeOptionalText(payload.kana, 120, "フリガナ"),
    phone: normalizeOptionalText(payload.phone, 40, "電話番号"),
    email: normalizeOptionalText(payload.email, 120, "メールアドレス"),
    sex: normalizeOptionalText(payload.sex, 20, "性別"),
    birthDate: normalizeOptionalText(payload.birthDate, 20, "生年月日"),
    notes: normalizeOptionalText(payload.notes, 2000, "メモ"),
    allergies: normalizeOptionalText(payload.allergies, 1000, "アレルギー"),
    chiefComplaint: normalizeOptionalText(payload.chiefComplaint, 1000, "主訴")
  };
}

function validateAppointmentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError("リクエスト本文は JSON オブジェクトである必要があります。");
  }

  const patientId = normalizeOptionalText(payload.patientId, 64, "患者ID");
  const patientName = normalizeOptionalText(payload.patientName, 120, "患者名");
  if (!patientName) {
    throw createValidationError("患者名は必須です。");
  }

  const preferredDate = normalizeOptionalDateTime(payload.preferredDate, "希望日時");
  if (!preferredDate) {
    throw createValidationError("希望日時は必須です。");
  }

  return {
    patientId,
    patientName,
    kana: normalizeOptionalText(payload.kana, 120, "フリガナ"),
    phone: normalizeOptionalText(payload.phone, 40, "電話番号"),
    email: normalizeOptionalText(payload.email, 120, "メールアドレス"),
    preferredDate,
    preferredTime: normalizeOptionalText(payload.preferredTime, 40, "希望時間帯"),
    visitType: normalizeOptionalText(payload.visitType, 40, "予約種別") || "初診",
    reason: normalizeOptionalText(payload.reason, 2000, "予約理由"),
    notes: normalizeOptionalText(payload.notes, 2000, "備考"),
    firstVisit: normalizeOptionalBoolean(payload.firstVisit)
  };
}

function validatePatientReportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError("リクエスト本文は JSON オブジェクトである必要があります。");
  }

  const title = normalizeOptionalText(payload.title, 120, "タイトル");
  const body = normalizeOptionalText(payload.body, 4000, "本文");

  if (!title) {
    throw createValidationError("タイトルは必須です。");
  }
  if (!body) {
    throw createValidationError("本文は必須です。");
  }

  return { title, body };
}

module.exports = {
  createValidationError,
  normalizeIdentifier,
  normalizeOptionalBoolean,
  normalizeOptionalDateTime,
  normalizeOptionalText,
  sanitizeText,
  validateAppointmentPayload,
  validatePatientPayload,
  validatePatientReportPayload,
  validateGeneratePayload,
  validateXrayAnalysisPayload
};
