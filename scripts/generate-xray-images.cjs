const fs = require("fs");
const path = require("path");
const { config } = require("../server/config");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "assets", "xrays");
const IMAGE_MODEL_CANDIDATES = ["gpt-image-1.5", "gpt-image-1"];

const PROMPTS = [
  {
    fileName: "panorama-01.png",
    size: "1536x1024",
    quality: "high",
    prompt: [
      "Photorealistic dental panoramic x-ray image for a medical web prototype.",
      "Wide grayscale panoramic scan of adult dentition, clinically plausible anatomy, high detail, centered composition.",
      "No labels, no watermark, no overlays, no color, no text. Clean diagnostic look, subtle contrast, realistic x-ray texture."
    ].join(" ")
  },
  {
    fileName: "dental-01.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic intraoral dental x-ray image for a clinical demo.",
      "Focused dental radiograph with visible crown, roots, and surrounding bone, grayscale only, realistic medical imaging style.",
      "No readable text, no labels, no watermark, no annotation, clinically plausible and crisp."
    ].join(" ")
  },
  {
    fileName: "anterior-01.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic dental x-ray emphasizing anterior teeth for a demo case.",
      "Grayscale radiograph style, teeth and roots clearly visible, realistic clinical contrast, tidy centered framing.",
      "No text, no logo, no color, no annotation, no watermark."
    ].join(" ")
  },
  {
    fileName: "molar-01.png",
    size: "1024x1024",
    quality: "high",
    prompt: [
      "Photorealistic dental x-ray emphasizing molar region for a clinical prototype.",
      "Grayscale diagnostic image with posterior teeth, roots, and bone structure visible, realistic dental radiograph style.",
      "No readable text, no annotations, no watermark, no color, no brand marks."
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
