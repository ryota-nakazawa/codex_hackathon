const test = require("node:test");
const assert = require("node:assert/strict");

const { generateReport } = require("../server/report-service");
const { validateGeneratePayload } = require("../server/validation");

test("validation rejects unsupported image types", () => {
  assert.throws(
    () =>
      validateGeneratePayload({
        patientRequest: "痛い",
        image: {
          name: "x.svg",
          type: "image/svg+xml",
          size: 10,
          dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
        }
      }),
    /PNG \/ JPEG \/ WebP/
  );
});

test("fallback report includes markdown output", async () => {
  const report = await generateReport({
    mode: "fallback",
    patientId: "CASE-1",
    caseId: "",
    patientRequest: "噛むと痛い",
    chartNotes: "右上6番に違和感あり",
    image: null
  });

  assert.match(report.markdown, /# 補助レポート/);
  assert.match(report.markdown, /## Checklist/);
  assert.ok(report.sections.quickOverview);
  assert.ok(report.sections.explanation);
});

test("dangerous text is sanitized in generated output", async () => {
  const report = await generateReport({
    mode: "fallback",
    patientId: "",
    caseId: "",
    patientRequest: "",
    chartNotes: "<script>alert(1)<\/script> 痛みがある",
    image: null
  });

  assert.doesNotMatch(report.sections.quickOverview.summary, /<script>/);
  assert.doesNotMatch(report.markdown, /<script>/);
});
