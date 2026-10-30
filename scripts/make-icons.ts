// Renders the app icons (route-hue mark) to PNG. Run once when the brand changes:
//   pnpm exec tsx scripts/make-icons.ts
import { chromium } from "playwright";

const SIZES: [string, number, boolean][] = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];

const html = (size: number, maskable: boolean) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? "#0e1116" : "transparent"}">
  <div style="width:${maskable ? size * 0.62 : size}px;height:${maskable ? size * 0.62 : size}px;border-radius:${maskable ? size * 0.16 : size * 0.22}px;
    background:conic-gradient(from 200deg,hsl(175 70% 40%),hsl(220 70% 50%),hsl(280 60% 55%),hsl(330 65% 52%),hsl(25 85% 50%),hsl(175 70% 40%));
    display:grid;place-items:center">
    <div style="width:44%;height:44%;border-radius:50%;background:#ffffff"></div>
  </div>
</div></body></html>`;

const browser = await chromium.launch();
for (const [file, size, maskable] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size, maskable));
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !maskable });
  await page.close();
}
await browser.close();
console.log("✓ icons written to public/icons");
