export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "通信に失敗しました。");
  }
  return payload;
}

export function setMessage(element, tone, message) {
  if (!element) {
    return;
  }
  element.className = `message ${tone}`;
  element.textContent = message;
}

export function formatDateTime(value) {
  if (!value) {
    return "未設定";
  }
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDate(value) {
  if (!value) {
    return "未設定";
  }
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function statusClass(status) {
  if (status === "confirmed" || status === "予約済み" || status === "通院中") {
    return "tone-good";
  }
  if (status === "tentative" || status === "再治療相談") {
    return "tone-warn";
  }
  return "tone-calm";
}
