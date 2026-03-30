const fs = require("fs");
const path = require("path");
const { config } = require("../server/config");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "assets");
const IMAGE_MODEL_CANDIDATES = ["gpt-image-1.5", "gpt-image-1"];

const PROMPTS = [
  {
    fileName: "hero-dental-team.png",
    size: "1536x1024",
    quality: "high",
    prompt: [
      "Photorealistic Japanese dental clinic hero image for a premium website.",
      "Wide editorial composition with generous negative space, calm atmosphere, subjects placed slightly off-center.",
      "A dentist and hygienist consulting a patient in a bright modern clinic, relaxed expressions, elegant white and soft blue interior accents.",
      "Large windows, uncluttered counter, airy reception background, no readable text, no logos, no watermark, high realism, natural skin texture.",
      "Commercial healthcare website hero shot, not crowded, not close-up, smart and spacious framing."
    ].join(" ")
  },
  {
    fileName: "clinic-lounge.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic waiting lounge of a Japanese dental clinic for a website hero card.",
      "Spacious, minimal, warm interior with lots of empty breathing room, soft natural light, clean reception desk, elegant beige and wood accents.",
      "No people, no readable signage, no logos, realistic photography, polished but approachable, calm premium atmosphere."
    ].join(" ")
  },
  {
    fileName: "xray-consultation.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic consultation scene in a Japanese dental clinic with a relaxed, spacious composition.",
      "Dentist explaining x-ray findings to a patient using a monitor, framed from a medium distance, plenty of negative space around the subjects.",
      "Modern clinic room, calm and reassuring atmosphere, no readable text on screen, no logos, realistic healthcare photography, editorial style."
    ].join(" ")
  },
  {
    fileName: "feature-treatment.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic Japanese dental treatment explanation scene for a premium healthcare website.",
      "Dentist and patient sitting at a consultation desk, medium-wide framing, tidy desk, generous empty space in the composition, elegant clean clinic.",
      "Friendly and composed expressions, no readable text, no logos, realistic editorial photography, calm and upscale."
    ].join(" ")
  }
];

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateWithModel(model, promptConfig) {
  const response = await fetch(`${config.openai.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt: promptConfig.prompt,
      size: promptConfig.size,
      quality: promptConfig.quality,
      output_format: "png"
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && payload.error && payload.error.message
        ? payload.error.message
        : "image generation failed";
    throw new Error(message);
  }

  const imageBase64 = payload && payload.data && payload.data[0] && payload.data[0].b64_json;
  if (!imageBase64) {
    throw new Error("b64_json が返りませんでした。");
  }

  return Buffer.from(imageBase64, "base64");
}

async function generateImage(promptConfig) {
  let lastError = null;

  for (const model of IMAGE_MODEL_CANDIDATES) {
    try {
      console.log(`Generating ${promptConfig.fileName} with ${model}...`);
      const imageBuffer = await generateWithModel(model, promptConfig);
      const outputPath = path.join(OUTPUT_DIR, promptConfig.fileName);
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`Saved ${outputPath}`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed with ${model}: ${error.message}`);
    }
  }

  throw lastError || new Error(`${promptConfig.fileName} の生成に失敗しました。`);
}

async function main() {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY が未設定です。");
  }

  ensureOutputDir();

  for (const promptConfig of PROMPTS) {
    await generateImage(promptConfig);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
