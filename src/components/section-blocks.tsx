import type { Block, Section } from "@/content/types";

function Html({ html, className = "prose" }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "html":
      return <Html html={block.html} />;
    case "lab-step":
      return (
        <div
          className="lab-step mt-6 border-l-4 border-hairline pl-3 sm:pl-4"
          id={block.anchor}
          data-step={block.key}
        >
          <h3 className="text-lg font-bold leading-snug">
            <span className="text-muted">Step {block.label} — </span>
            {block.title}
          </h3>
          <Html html={block.html} className="prose mt-2" />
        </div>
      );
    case "lab-troubleshoot":
      return (
        <details className="mt-6 rounded-lg border border-hairline bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">
            {block.title}
          </summary>
          <Html html={block.html} className="prose pb-4" />
        </details>
      );
    case "lab-commit":
      return (
        <div className="mt-6 rounded-lg border border-hairline p-4">
          <h3 className="font-bold">Commit it</h3>
          <Html html={block.html} className="prose mt-2" />
        </div>
      );
    case "drill-reveal":
      return (
        <details className="mt-6 rounded-lg border border-hairline px-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-accent">
            How an experienced engineer reasons
          </summary>
          <Html html={block.html} className="prose pb-4" />
        </details>
      );
    case "prompt":
      return (
        <div className="prompt mt-3 rounded-lg border border-hairline bg-surface p-4">
          <Html html={block.html} />
          <button
            type="button"
            className="code-copy mt-2"
            data-copy-text={block.text}
            aria-label="Copy prompt"
          >
            Copy prompt
          </button>
        </div>
      );
    case "card":
      return (
        <Html
          html={block.html}
          className="prose question mt-2 rounded-md border border-hairline px-4 py-2"
        />
      );
  }
}

export function SectionView({ section }: { section: Section }) {
  return (
    <section
      id={section.key}
      aria-labelledby={`${section.key}-h`}
      data-section={section.key}
      data-type={section.type}
      className="mt-12 first:mt-8"
    >
      {section.key !== "intro" && (
        <h2 id={`${section.key}-h`} className="text-2xl font-bold leading-tight">
          {section.title}
        </h2>
      )}
      <div className="mt-4">
        {section.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </section>
  );
}
