const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createApp } = require("../server/app");

async function withServer(run) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("GET / serves the app shell", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /page-home/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  });
});

test("GET /reserve serves the reservation page shell", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reserve`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /page-reserve/);
  });
});

test("GET /dashboard serves the management page shell", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/dashboard`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /page-dashboard/);
  });
});

test("GET /patients/:id serves the patient detail shell", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/patients/p-001`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /page-patient/);
  });
});

test("GET /api/bootstrap returns patients and appointments", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/bootstrap`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(payload.patients.length >= 1);
    assert.ok(payload.appointments.length >= 1);
    assert.ok(payload.availability);
    assert.ok(Array.isArray(payload.availability.days));
  });
});

test("GET /api/availability returns hourly slots", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/availability`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.availability.slotMinutes, 60);
    assert.ok(Array.isArray(payload.availability.days));
    assert.ok(payload.availability.days.some((day) => Array.isArray(day.slots) && day.slots.length > 0));
  });
});

test("POST /api/generate-report returns report for memo-only input", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "fallback",
        patientId: "CASE-2026-001",
        chartNotes: "右上6番に冷水痛あり"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.report.meta.modeUsed, "fallback");
    assert.match(payload.report.sections.quickOverview.summary, /テキスト入力から/);
  });
});

test("POST /api/patients creates a new patient", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "大野 由奈",
        kana: "オオノ ユナ",
        phone: "090-1212-3434",
        birthDate: "1994-01-12",
        sex: "女性",
        chiefComplaint: "定期検診を希望",
        notes: "初診希望"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.ok, true);
    assert.equal(payload.patient.name, "大野 由奈");
  });
});

test("POST /api/generate-report blocks cross-origin requests", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://example.com"
      },
      body: JSON.stringify({
        mode: "fallback",
        patientRequest: "しみる"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Cross-origin requests are not allowed/);
  });
});

test("POST /api/generate-report rejects non-JSON content types", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: "mode=fallback"
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /application\/json/);
  });
});
