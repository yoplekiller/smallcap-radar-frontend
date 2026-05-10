import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dir, "../public/icon.svg");
const svg = readFileSync(svgPath);

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
];

for (const { name, size } of sizes) {
  const out = join(__dir, "../public", name);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`✓ ${name} (${size}x${size})`);
}
console.log("아이콘 생성 완료!");
