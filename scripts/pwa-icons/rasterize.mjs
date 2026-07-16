import pw from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const jobs = [
  { svg: "icon.svg", size: 192, out: "icon-192.png" },
  { svg: "icon.svg", size: 512, out: "icon-512.png" },
  { svg: "icon.svg", size: 180, out: "apple-touch-icon.png" },
  { svg: "maskable.svg", size: 512, out: "maskable-512.png" },
];

const browser = await pw.chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  const svg = readFileSync(join(here, job.svg), "utf8");
  const b64 = Buffer.from(svg).toString("base64");
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<html><body style="margin:0;padding:0">
       <img width="${job.size}" height="${job.size}"
            src="data:image/svg+xml;base64,${b64}"/>
     </body></html>`,
    { waitUntil: "networkidle" }
  );
  await page.screenshot({
    path: join(outDir, job.out),
    clip: { x: 0, y: 0, width: job.size, height: job.size },
    omitBackground: false,
  });
  console.log("wrote", job.out, `${job.size}x${job.size}`);
}
await browser.close();
