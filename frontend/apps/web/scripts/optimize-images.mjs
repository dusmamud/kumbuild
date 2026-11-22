/* Build-time image pipeline (sharp) — koi runtime cost nahi.
   Har badi public image ke liye AVIF + WebP variants (aur JPG/PNG originals
   ke resized fallback) deterministic naam se banta hai:
     /work/foo.webp  ->  /work/foo-480.avif, foo-800.avif, foo-1280.avif,
                         /work/foo-480.webp, ... (original bhi fallback rehta hai)
   SmartImage.astro inhi naam-convention se <picture> emit karta hai.
   Incremental: jo variant source se naya hai, woh skip hota hai.
   Chalao:  node scripts/optimize-images.mjs   (ya pnpm script "images") */
import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(root, "..", "public");
const DIRS = ["work", "about", "services", "blog", "hero"];
const WIDTHS = [480, 800, 1280];
const HERO_WIDTHS = [768]; // hero ke 520/1040 pehle se haath se bane hain; sirf beech wala jodo
const SRC_EXT = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const VARIANT_RE = /-\d+\.(avif|webp|jpg|jpeg|png)$/;

let made = 0, skipped = 0, savedIn = 0, savedOut = 0;

async function variantsFor(file, dir) {
  const ext = path.extname(file).toLowerCase();
  const base = file.slice(0, -ext.length);
  const srcPath = path.join(PUBLIC, dir, file);
  const meta = await sharp(srcPath).metadata();
  const widths = (dir === "hero" ? HERO_WIDTHS : WIDTHS).filter((w) => w < meta.width);
  const jobs = [];
  for (const w of widths) {
    jobs.push({ out: `${base}-${w}.avif`, fmt: "avif", w });
    jobs.push({ out: `${base}-${w}.webp`, fmt: "webp", w });
    if (ext === ".jpg" || ext === ".jpeg") jobs.push({ out: `${base}-${w}.jpg`, fmt: "jpeg", w });
    if (ext === ".png") jobs.push({ out: `${base}-${w}.png`, fmt: "png", w });
  }
  const srcMtime = (await stat(srcPath)).mtimeMs;
  for (const job of jobs) {
    const outPath = path.join(PUBLIC, dir, job.out);
    if (existsSync(outPath) && (await stat(outPath)).mtimeMs >= srcMtime) { skipped++; continue; }
    let pipe = sharp(srcPath).resize({ width: job.w });
    if (job.fmt === "avif") pipe = pipe.avif({ quality: 55, effort: 4 });
    if (job.fmt === "webp") pipe = pipe.webp({ quality: 75 });
    if (job.fmt === "jpeg") pipe = pipe.jpeg({ quality: 78, mozjpeg: true });
    if (job.fmt === "png") pipe = pipe.png({ compressionLevel: 9 });
    await pipe.toFile(outPath);
    made++;
    savedOut += (await stat(outPath)).size;
  }
  savedIn += (await stat(srcPath)).size;
}

for (const dir of DIRS) {
  const abs = path.join(PUBLIC, dir);
  if (!existsSync(abs)) continue;
  for (const file of await readdir(abs)) {
    const ext = path.extname(file).toLowerCase();
    if (!SRC_EXT.has(ext) || VARIANT_RE.test(file)) continue;
    await variantsFor(file, dir);
  }
}

/* OG image: 2048x1152 PNG master se 1200x630 JPG (social standard size). */
const ogPng = path.join(PUBLIC, "og", "kumbuild-og.png");
const ogJpg = path.join(PUBLIC, "og", "kumbuild-og.jpg");
if (existsSync(ogPng) && (!existsSync(ogJpg) || (await stat(ogJpg)).mtimeMs < (await stat(ogPng)).mtimeMs)) {
  await sharp(ogPng).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 80, mozjpeg: true }).toFile(ogJpg);
  made++;
  console.log("og: kumbuild-og.jpg", Math.round((await stat(ogJpg)).size / 1024), "KiB");
}

console.log(`done: ${made} variants bane, ${skipped} skip (pehle se naye), sources ${(savedIn / 1048576).toFixed(1)} MiB`);
