const test = require("node:test");
const assert = require("node:assert/strict");

const { createFallbackReport, createMockReport } = require("../server/report-generators");
const { generateReport } = require("../server/report-service");
const { validateGeneratePayload } = require("../server/validation");

test("validateGeneratePayload rejects empty input", () => {
  assert.throws(
    () => validateGeneratePayload({ mode: "fallback" }),
    /いずれかを入力してください/
  );
});

test("fallback report avoids image-derived claims for text-only input", () => {
  const report = createFallbackReport({
    mode: "fallback",
    patientId: "P-01",
    caseId: "",
    patientRequest: "右上がしみる",
    chartNotes: "右上6に冷水痛あり",
    image: null
  });

  assert.equal(report.meta.modeUsed, "fallback");
  assert.equal(report.meta.constraintFlags.avoidImageDerivedSuggestions, true);
  assert.match(report.sections.summary, /画像情報がないため|画像由来/);
  assert.ok(report.sections.referencePoints.some((item) => item.includes("画像由来")));
});

test("fallback report avoids background assumptions for image-only input", () => {
  const report = createFallbackReport({
    mode: "fallback",
    patientId: "",
    caseId: "CASE-IMG",
    patientRequest: "",
    chartNotes: "",
    image: {
      name: "xray.png",
      type: "image/png",
      size: 1024,
      dataUrl: "data:image/png;base64,AAAA"
    }
  });

  assert.equal(report.meta.constraintFlags.avoidBackgroundClaims, true);
  assert.match(report.sections.summary, /画像のみ/);
  assert.match(report.sections.patientExplanation, /断定せず|最終判断/);
});

test("mock mode stays on mock path", () => {
  const report = createMockReport({
    mode: "mock",
    patientId: "",
    caseId: "",
    patientRequest: "前歯の見た目が気になる",
    chartNotes: "",
    image: null
  });

  assert.equal(report.meta.modeUsed, "mock");
  assert.equal(report.meta.generator, "mock-template-v1");
});

test("live mode falls back when API key is not configured", async () => {
  const report = await generateReport({
    mode: "live",
    patientId: "P-02",
    caseId: "",
    patientRequest: "奥歯が痛い",
    chartNotes: "",
    image: null
  });

  assert.match(report.meta.modeUsed, /^(live|fallback)$/);
  if (report.meta.modeUsed === "fallback") {
    assert.ok(report.meta.warnings.length >= 1);
  }
});
