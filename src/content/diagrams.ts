// Build-time only (Node): renders Mermaid sources to light and dark SVG files with
// headless Chromium, caching by source hash so unchanged diagrams are never re-rendered.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { diagramHash } from "./render";
import type { DiagramRenders } from "./types";

const require = createRequire(import.meta.url);

const THEMES = { light: "neutral", dark: "dark" } as const;
const FONT = "Arial, Helvetica, sans-serif";

function mermaidVersion(): string {
  const pkg = JSON.parse(readFileSync(require.resolve("mermaid/package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

function sizeOf(svg: string): { width: number; height: number } {
  const vb = svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
  if (!vb) return { width: 800, height: 400 };
  return { width: Math.ceil(Number(vb[1])), height: Math.ceil(Number(vb[2])) };
}

export interface RenderDiagramsOptions {
  cacheDir: string;
  outDir: string;
  log?: (msg: string) => void;
}

/**
 * Ensures every source has light/dark SVGs in `outDir`. Returns sizes for those that
 * rendered. If Chromium is unavailable, returns what the cache already has and logs why.
 */
export async function renderDiagrams(
  sources: string[],
  opts: RenderDiagramsOptions,
): Promise<DiagramRenders> {
  const log = opts.log ?? (() => {});
  const cache = path.join(opts.cacheDir, `mermaid-${mermaidVersion()}`);
  mkdirSync(cache, { recursive: true });
  mkdirSync(opts.outDir, { recursive: true });

  const unique = [...new Map(sources.map((s) => [diagramHash(s), s.trim()])).entries()];
  const missing = unique.filter(([id]) => !existsSync(path.join(cache, `${id}.json`)));

  if (missing.length > 0) {
    log(`Rendering ${missing.length} diagram(s) with headless Chromium…`);
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.setContent("<!doctype html><html><body></body></html>");
        await page.addScriptTag({ path: require.resolve("mermaid/dist/mermaid.min.js") });
        for (const [id, source] of missing) {
          const out: Record<string, string> = {};
          for (const [name, theme] of Object.entries(THEMES)) {
            out[name] = await page.evaluate(
              async ({ id, source, theme, font }) => {
                const m = (
                  window as unknown as {
                    mermaid: {
                      initialize: (c: object) => void;
                      render: (id: string, src: string) => Promise<{ svg: string }>;
                    };
                  }
                ).mermaid;
                m.initialize({
                  startOnLoad: false,
                  securityLevel: "strict",
                  theme,
                  fontFamily: font,
                  htmlLabels: false,
                  flowchart: { htmlLabels: false },
                });
                const { svg } = await m.render(`d${id}`, source);
                return svg;
              },
              { id, source, theme, font: FONT },
            );
          }
          writeFileSync(path.join(cache, `${id}-light.svg`), out.light!);
          writeFileSync(path.join(cache, `${id}-dark.svg`), out.dark!);
          writeFileSync(path.join(cache, `${id}.json`), JSON.stringify(sizeOf(out.light!)));
        }
      } finally {
        await browser.close();
      }
    } catch (err) {
      log(
        `Diagram rendering unavailable (${(err as Error).message.split("\n")[0]}); falling back to text for un-cached diagrams.`,
      );
    }
  }

  const renders: DiagramRenders = {};
  for (const [id] of unique) {
    const meta = path.join(cache, `${id}.json`);
    if (!existsSync(meta)) continue;
    renders[id] = JSON.parse(readFileSync(meta, "utf8")) as { width: number; height: number };
    for (const theme of ["light", "dark"]) {
      copyFileSync(
        path.join(cache, `${id}-${theme}.svg`),
        path.join(opts.outDir, `${id}-${theme}.svg`),
      );
    }
  }
  return renders;
}
