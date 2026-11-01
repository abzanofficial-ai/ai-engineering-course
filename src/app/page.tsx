import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/icons";
import { defaultBranding as brand } from "@/lib/branding";
import { getGlossary, getManifest, pageHref } from "@/lib/content";
import { partHue } from "@/lib/hues";
import { routeData } from "@/lib/route-data";

// The public landing page: static, crawlable, and built only from facts in the course itself
// (counts from the manifest, outcomes from the Index, promises from "How to use this book").
// No earnings guarantees and no testimonials until real ones exist.

const COURSE = brand.defaultCourse;
const manifest = getManifest(COURSE)!;
const route = routeData(COURSE, manifest);
// "47 chapters, plus a quick-start Chapter 0" (How to use this book): count Chapters 1 onwards.
const chaptersAll = manifest.pages.filter((p) => p.kind === "chapter" && (p.number ?? 0) > 0);
const chaptersReady = chaptersAll.filter((p) => p.status === "published").length;
const terms = getGlossary(COURSE).length;
const ch1 = manifest.pages.find((p) => p.key === "ch-1")!;
const startHref = pageHref(COURSE, ch1);
const stripTags = (html: string) => html.replace(/<[^>]+>/g, "");

const TITLE = `${brand.name}: become an AI engineer, from zero to hired`;
const DESCRIPTION =
  "A practical route from beginner to job-ready AI engineer: 15 parts, hands-on labs, decision drills and interview practice. Build one real AI product across the course, then get hired, freelance or launch your own.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  keywords: [
    "AI engineering course",
    "learn AI engineering",
    "become an AI engineer",
    "LLM course",
    "RAG tutorial",
    "AI agents course",
    "AI engineer interview preparation",
    "freelance AI developer",
    "build an AI startup",
    "AI course for non-technical founders",
  ],
  openGraph: {
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    siteName: brand.name,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Do I need to know how to code?",
    a: "No. Part 1 starts with Python from the beginning, and every technical term is explained in plain words the first time it appears. If you can use a computer and give it a few hours a week, you can start.",
  },
  {
    q: "How long does it take?",
    a: "Expect six to nine months at a steady pace alongside a job, and faster if you already code. Every chapter shows its reading time and lab time, so you can plan your week.",
  },
  {
    q: "When can I start earning or interviewing?",
    a: "The course is built so you can earn money from Part 8 onwards, when you can build a retrieval-augmented (RAG) product a business will pay for, and pass a serious interview from Part 13 onwards, after system design. How quickly that turns into work depends on you, your market and the effort you put into applying; nobody can honestly promise a job or an income.",
  },
  {
    q: "Is it free?",
    a: `While we launch, every signed-in learner gets the full course free. Chapter 1 and the Start here guide are open without an account. Paid plans come later, and we will tell you before anything changes.`,
  },
  {
    q: "Is the whole course written?",
    a: `${chaptersReady} of ${chaptersAll.length} chapters are ready now, covering Parts 1 to 10: programming, maths, machine learning, deep learning, transformers, LLMs, vector search, RAG, agents and AI application engineering. The remaining chapters on evaluation, production, system design, fine-tuning and getting hired are marked "coming soon" and are added as they are finished.`,
  },
  {
    q: "Do I get a certificate?",
    a: "Yes. Finish every chapter in a part and pass its checkpoint to claim a certificate for that part. Each one has a public link anyone can use to check it is genuine.",
  },
  {
    q: "Can my training centre or company use it?",
    a: "Yes: as a branded site for your learners, or by buying places for your students, who join with a code. See the plans for centres.",
  },
];

const MODES = [
  {
    key: "learn",
    title: "Learn",
    text: "One idea at a time, in plain English, with diagrams. Every term you meet is a tap away from its definition.",
  },
  {
    key: "practise",
    title: "Practise",
    text: "A numbered lab on your own machine: the commands, the code, what you should see, and what to do when it breaks.",
  },
  {
    key: "decide",
    title: "Decide",
    text: "A real client scenario. Write your answer first, then see how an experienced engineer reasons it through.",
  },
  {
    key: "review",
    title: "Review",
    text: "Interview questions as flashcards. The ones you're unsure of come back at the right time until they stick.",
  },
] as const;

const GOALS = [
  {
    icon: "medal",
    title: "Get hired",
    text: "Practise the questions AI engineering interviews ask, the decisions they probe, and the system design round. Built for roles like AI engineer, forward-deployed engineer and solutions architect.",
    when: "Interview-ready from Part 13",
  },
  {
    icon: "star",
    title: "Freelance",
    text: "By Part 8 you can build a retrieval-augmented assistant over a business's own documents: the first product clients will pay for. Part 15 adds industry playbooks and freelancing (coming soon).",
    when: "Earn from Part 8",
  },
  {
    icon: "blocks",
    title: "Build your own product",
    text: "The capstone is a real, deployed, monitored product with costs under control. It is the same skill set you need to launch an AI product of your own.",
    when: "One product, built across the course",
  },
  {
    icon: "decide",
    title: "Lead the decisions",
    text: "Every chapter ends with where the judgment is: what you can hand to an AI, and what you must be able to decide yourself. That is what separates senior engineers.",
    when: "In every chapter",
  },
] as const;

// Idea → product → paying customers, mapped to the parts that teach each step (Index outcomes).
const FOUNDER_STEPS = [
  {
    step: "Idea",
    title: "Prove it works",
    text: "Learn enough Python, APIs and prompting to build a working AI feature yourself, without waiting for a developer.",
    parts: "Parts 1 to 6",
    soon: false,
  },
  {
    step: "Product",
    title: "Build something people pay for",
    text: "Answer questions from a business's own documents, take real actions safely, and ship a full product with a real interface.",
    parts: "Parts 8 to 10",
    soon: false,
  },
  {
    step: "Paying customers",
    title: "Run it and sell it",
    text: "Keep it reliable and its costs under control, then find clients, price your work and run it as a SaaS.",
    parts: "Parts 11 to 15",
    soon: true,
  },
] as const;

const PROMISES = [
  {
    title: "No unexplained jargon",
    text: "Every technical term is defined in plain words before it is used, and each chapter opens with its own jargon decoder.",
  },
  {
    title: "You build, not just read",
    text: "Every chapter ends with a practice lab you run on your own computer. Do every lab and you finish with a portfolio.",
  },
  {
    title: "You learn to decide",
    text: "Clients and interviewers describe a mess and expect an approach. Decision drills train exactly that.",
  },
];

const CAPSTONE = [
  ["Parts 1–2", "Ingest the client's messy exports into a clean database"],
  ["Parts 3–6", "Classify inbound enquiries and extract the details"],
  ["Parts 7–8", "Answer questions from listings, policies and tenancy agreements"],
  ["Part 9", "An agent that qualifies leads and books viewings, safely"],
  ["Part 10", "Memory, photo assessment and a real interface"],
  ["Part 11", "Evaluations, guardrails, GDPR handling and a bias review"],
  ["Parts 12–13", "Deployed, monitored, cost-capped and documented"],
] as const;

const APP = [
  [
    "flame",
    "Streaks and a weekly goal",
    "Small, steady progress, with a freeze when life gets in the way.",
  ],
  [
    "review",
    "Spaced repetition",
    "Questions you're unsure of come back after 1, 3, 7, 14 and 30 days.",
  ],
  ["check", "Part checkpoints", "Ten questions and a decision drill to prove a part has stuck."],
  ["medal", "Verifiable certificates", "A public link for each part you complete."],
  ["search", "Search and glossary", `Every section searchable, and ${terms} terms defined.`],
  ["note", "Notes and bookmarks", "Your own notes on any section, synced across devices."],
] as const;

function jsonLd() {
  const course = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: manifest.title,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    educationalLevel: "Beginner",
    provider: { "@type": "Organization", name: brand.name },
    teaches: route.parts
      .filter((p) => p.number > 0)
      .map((p) => `${p.title}: ${stripTags(p.outcomeHtml)}`),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: "P6M",
    },
    offers: {
      "@type": "Offer",
      category: "Free",
      price: 0,
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
    },
    syllabusSections: route.parts
      .filter((p) => p.number > 0)
      .map((p) => ({
        "@type": "Syllabus",
        name: `Part ${p.number}: ${p.title}`,
        description: stripTags(p.outcomeHtml),
      })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  // Escape "<" so content can never close the script element.
  return JSON.stringify([course, faq]).replace(/</g, "\\u003c");
}

export default function Landing() {
  const parts = route.parts;
  return (
    <main id="main" className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />

      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">
              <span className="lp-dot" aria-hidden="true" /> Free while we launch · {chaptersReady}{" "}
              chapters ready
            </p>
            <h1 id="lp-title">
              From zero to <span className="lp-grad">AI engineer</span>, and paid for it.
            </h1>
            <p className="lp-lede">
              One practical route from your first line of Python to building AI products people pay
              for. Read it, build it, decide it, explain it: then get hired, freelance, or launch
              your own.
            </p>
            <div className="lp-ctas">
              <Link className="lp-btn lp-btn-primary" href={startHref}>
                Start free with Chapter 1 <Icon name="arrow" />
              </Link>
              <a className="lp-btn lp-btn-ghost" href="#route">
                See the route
              </a>
            </div>
            <p className="lp-small">No card. Chapter 1 is open without an account.</p>
          </div>

          <div className="lp-hero-art" aria-hidden="true">
            <div className="lp-orbit">
              {parts
                .filter((p) => p.number > 0)
                .map((p, i, all) => (
                  <span
                    key={p.number}
                    className={`lp-star${p.milestone ? " lp-star-big" : ""}`}
                    style={
                      {
                        "--h": partHue(p.number),
                        "--a": `${(i / all.length) * 360}deg`,
                        "--d": `${i * 0.12}s`,
                      } as CSSProperties
                    }
                  >
                    {p.number}
                  </span>
                ))}
              <div className="lp-core">
                <b>15</b>
                <span>parts</span>
              </div>
            </div>
            <div className="lp-float lp-float-a">
              <Icon name="check" /> Lab step 4 done <em>+10 XP</em>
            </div>
            <div className="lp-float lp-float-b">
              <Icon name="flame" /> 12-day streak
            </div>
          </div>
        </div>

        <div className="lp-wrap">
          <dl className="lp-stats">
            <div>
              <dt>Parts</dt>
              <dd>15</dd>
            </div>
            <div>
              <dt>Hands-on lab steps</dt>
              <dd>{route.counts.steps}</dd>
            </div>
            <div>
              <dt>Decision drills</dt>
              <dd>{route.counts.drills}</dd>
            </div>
            <div>
              <dt>Interview questions</dt>
              <dd>{route.counts.questions}</dd>
            </div>
            <div>
              <dt>Terms explained</dt>
              <dd>{terms}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="lp-section lp-founders" aria-labelledby="founders-h">
        <div className="lp-wrap">
          <p className="lp-kicker">For founders</p>
          <h2 id="founders-h" className="lp-founders-title">
            From Idea to Customers: <span className="lp-grad">Building your Startup with AI</span>
          </h2>
          <p className="lp-founders-sub">
            For non-technical founders who want to go from idea → product → paying customers
          </p>
          <p className="lp-sub">
            You don&apos;t need a technical co-founder to start. The course takes you from zero to
            building the product yourself, in plain English, one chapter at a time.
          </p>
          <ol className="lp-founder-steps">
            {FOUNDER_STEPS.map((f) => (
              <li key={f.step} className="lp-card">
                <span className="lp-founder-step">{f.step}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <p className="lp-when">
                  {f.parts}
                  {f.soon && <span className="lp-badge lp-badge-soon">Coming soon</span>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="goals-h">
        <div className="lp-wrap">
          <p className="lp-kicker">Choose your finish line</p>
          <h2 id="goals-h">One course. Four ways to win.</h2>
          <p className="lp-sub">
            Everyone starts at the same place: zero. Where you finish is up to you.
          </p>
          <div className="lp-goals">
            {GOALS.map((g) => (
              <article key={g.title} className="lp-card lp-goal">
                <span className="lp-icon" aria-hidden="true">
                  <Icon name={g.icon} />
                </span>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
                <p className="lp-when">{g.when}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="promise-h">
        <div className="lp-wrap lp-split">
          <div>
            <p className="lp-kicker">Designed for complete beginners</p>
            <h2 id="promise-h">Three promises about how it&apos;s written</h2>
            <p className="lp-sub">
              Written for people moving into AI: developers, career changers, consultants and
              freelancers. If you can follow a recipe, you can follow a lab.
            </p>
          </div>
          <ol className="lp-promises">
            {PROMISES.map((p, i) => (
              <li key={p.title} className="lp-card">
                <span className="lp-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="modes-h">
        <div className="lp-wrap">
          <p className="lp-kicker">How a chapter works</p>
          <h2 id="modes-h">Not a PDF. Four ways to make it stick.</h2>
          <p className="lp-sub">
            Every chapter is split into four modes, so you always know what to do next, and the app
            remembers exactly where you left off.
          </p>
          <div className="lp-modes">
            {MODES.map((m) => (
              <article key={m.key} className={`lp-card lp-mode lp-m-${m.key}`}>
                <span className="lp-icon" aria-hidden="true">
                  <Icon name={m.key} />
                </span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint" id="route" aria-labelledby="route-h">
        <div className="lp-wrap">
          <p className="lp-kicker">The route</p>
          <h2 id="route-h">From your first line of code to your first client</h2>
          <p className="lp-sub">
            Fifteen parts, each ending in something you can do. {chaptersReady} of{" "}
            {chaptersAll.length} chapters are ready today; the rest are marked and added as they are
            written.
          </p>
          <ol className="lp-route">
            {parts.map((p) => {
              const chapters = p.pages.filter((x) => x.kind !== "start");
              const ready = p.pages.filter((x) => x.status === "published").length;
              return (
                <li
                  key={p.number}
                  className={`lp-stop${p.milestone ? " lp-milestone" : ""}${ready ? "" : " lp-soon"}`}
                  style={{ "--h": partHue(p.number) } as CSSProperties}
                >
                  <span className="lp-stop-dot" aria-hidden="true">
                    {p.number === 0 ? <Icon name="star" /> : p.number}
                  </span>
                  <details className="lp-stop-body">
                    <summary>
                      <span className="lp-stop-title">
                        {p.number === 0 ? p.title : `Part ${p.number} · ${p.title}`}
                        {p.milestone && (
                          <span className="lp-badge">
                            {p.number === 8 ? "Start earning" : "Interview-ready"}
                          </span>
                        )}
                        {!ready && <span className="lp-badge lp-badge-soon">Coming soon</span>}
                      </span>
                      <span className="lp-stop-outcome">You can: {stripTags(p.outcomeHtml)}</span>
                    </summary>
                    <ul>
                      {(chapters.length ? chapters : p.pages).map((c) => (
                        <li key={c.key}>
                          {c.label ? `${c.label}: ` : ""}
                          {c.title}
                          {c.status !== "published" && <em> (coming soon)</em>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="capstone-h">
        <div className="lp-wrap lp-split">
          <div>
            <p className="lp-kicker">The capstone</p>
            <h2 id="capstone-h">One real product, not forty exercises</h2>
            <p className="lp-sub">
              Every lab adds a layer to a single system for Harbour &amp; Finch, a fictional letting
              agency with three branches, 400 properties and an office manager who answers the same
              questions all day. A letting agency produces every problem an AI engineer meets: messy
              documents, personal data, phone calls, photos and actions that cost money if they go
              wrong.
            </p>
            <p className="lp-sub">
              By the end you have a deployed, monitored, documented product to show employers and
              clients.
            </p>
          </div>
          <ol className="lp-layers" aria-label="What you build, layer by layer">
            {CAPSTONE.map(([when, what], i) => (
              <li key={when} style={{ "--i": i } as CSSProperties}>
                <span>{when}</span>
                {what}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="app-h">
        <div className="lp-wrap">
          <p className="lp-kicker">Built like an app</p>
          <h2 id="app-h">Everything that keeps you going</h2>
          <p className="lp-sub">
            Install it on your phone, read offline, and pick up on any device.
          </p>
          <div className="lp-features">
            {APP.map(([icon, title, text]) => (
              <div key={title} className="lp-feature">
                <span className="lp-icon" aria-hidden="true">
                  <Icon name={icon} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="centres-h">
        <div className="lp-wrap lp-card lp-centres">
          <div>
            <p className="lp-kicker">For training centres and companies</p>
            <h2 id="centres-h">Teach it under your own name</h2>
            <p className="lp-sub">
              Run the course as your own branded site, or buy places for your learners, who join
              with a single code. We keep the content current.
            </p>
          </div>
          <Link className="lp-btn lp-btn-primary" href="/plans">
            See centre plans <Icon name="arrow" />
          </Link>
        </div>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="faq-h">
        <div className="lp-wrap lp-narrow">
          <p className="lp-kicker">Questions</p>
          <h2 id="faq-h">Before you start</h2>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final" aria-labelledby="final-h">
        <div className="lp-wrap">
          <h2 id="final-h">Your first model call is one chapter away.</h2>
          <p>Start with Python for AI Engineering. Free, and open without an account.</p>
          <div className="lp-ctas lp-ctas-center">
            <Link className="lp-btn lp-btn-light" href={startHref}>
              Start Chapter 1 <Icon name="arrow" />
            </Link>
            <Link className="lp-btn lp-btn-outline" href="/sign-in">
              Create a free account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
