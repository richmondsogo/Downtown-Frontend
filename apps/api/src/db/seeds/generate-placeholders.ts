import sharp from "sharp";
import path from "path";
import fs from "fs";

async function generatePlaceholders() {
  // __dirname is apps/api/src/db/seeds (5 levels from repo root)
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const outputDir = path.resolve(repoRoot, "apps/web/public/placeholders");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const items = [
    { name: "laptop", bg: "#1e293b", fg: "#38bdf8", accent: "#0284c7" },
    { name: "phone", bg: "#0f172a", fg: "#a855f7", accent: "#7c3aed" },
    { name: "book", bg: "#1c1917", fg: "#f59e0b", accent: "#d97706" },
    { name: "fashion", bg: "#18181b", fg: "#ec4899", accent: "#db2777" },
    { name: "appliance", bg: "#134e4a", fg: "#14b8a6", accent: "#0d9488" },
  ];

  for (const item of items) {
    // Generate an image with high-entropy gradients, text, and patterns
    // to match real product photograph compression properties
    const svgContent = `
    <svg width="1000" height="750" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad_${item.name}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${item.bg}" />
          <stop offset="50%" stop-color="${item.accent}" />
          <stop offset="100%" stop-color="${item.fg}" />
        </linearGradient>
      </defs>
      <rect width="1000" height="750" fill="url(#grad_${item.name})" />
      <g>
        <rect x="200" y="120" width="600" height="450" rx="32" fill="#000000" opacity="0.4" />
        <rect x="220" y="140" width="560" height="410" rx="24" fill="${item.bg}" opacity="0.9" />
        <circle cx="500" cy="345" r="110" fill="${item.fg}" opacity="0.35" />
        <rect x="280" y="470" width="440" height="28" rx="8" fill="${item.fg}" opacity="0.7" />
        <rect x="330" y="510" width="340" height="16" rx="6" fill="${item.fg}" opacity="0.5" />
      </g>
    </svg>
    `;

    const svgBuffer = Buffer.from(svgContent);

    // Create high-frequency noise buffer to simulate real camera sensor noise & texture
    const noiseWidth = 1000;
    const noiseHeight = 750;
    const noisePixels = Buffer.alloc(noiseWidth * noiseHeight * 4);
    for (let i = 0; i < noisePixels.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      noisePixels[i] = v;
      noisePixels[i + 1] = v;
      noisePixels[i + 2] = v;
      noisePixels[i + 3] = 45; // ~18% grain overlay
    }

    const baseImage = sharp(svgBuffer);
    const withNoise = await baseImage
      .composite([{
        input: noisePixels,
        raw: { width: noiseWidth, height: noiseHeight, channels: 4 },
        blend: "over"
      }])
      .png()
      .toBuffer();

    // 1. Display Variant (1000x750, target ~140 KB)
    const displayWebp = await sharp(withNoise)
      .resize(1000, 750)
      .webp({ quality: 63, effort: 4 })
      .toBuffer();

    const displayPath = path.join(outputDir, `${item.name}_display.webp`);
    fs.writeFileSync(displayPath, displayWebp);

    // 2. Thumb Variant (400x300, target ~20 KB)
    const thumbWebp = await sharp(withNoise)
      .resize(400, 300)
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    const thumbPath = path.join(outputDir, `${item.name}_thumb.webp`);
    fs.writeFileSync(thumbPath, thumbWebp);

    console.log(
      `Generated ${item.name}: Display ${(displayWebp.length / 1024).toFixed(1)} KB, Thumb ${(thumbWebp.length / 1024).toFixed(1)} KB`
    );
  }
}

generatePlaceholders().catch(console.error);
