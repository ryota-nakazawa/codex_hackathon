const fs = require("fs");
const path = require("path");

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = stripWrappingQuotes(rawValue.trim());
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  staticDir: path.join(__dirname, "..", "public"),
  maxBodyBytes: 8 * 1024 * 1024,
  maxTextLength: 6000,
  maxImageBytes: 4 * 1024 * 1024,
  rateLimitWindowMs: 60 * 1000,
  rateLimitMaxRequests: 30,
  allowedImageTypes: new Set(["image/png", "image/jpeg", "image/webp"]),
  requestTimeoutMs: 15000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  }
};

module.exports = { config };
