import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { defaultBranding as brand } from "@/lib/branding";
import { money, plans, seatPackPrice, yearlySaving } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

const per = (interval?: string) =>
  interval === "month" ? "a month" : interval === "year" ? "a year" : "once";

// The three offers (ADR-0030). Prices come from content/plans.json. Checkout arrives with
// billing (Phase 4); until then every signed-in learner has the full course.
export default function PlansPage() {
  const l = plans.centreLicence;
  const tiers = plans.seatPack.tiers;
  const saving = yearlySaving();
  return (
    <main id="main" className="wrap panel-wrap plans">
      <Link className="back" href="/home">
        <Icon name="back" /> Home
      </Link>
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Plans</h1>
      {brand.access.launchOpenToAllSignedIn && (
        <p className="notice">
          While we launch, every signed-in learner gets the full course free. Paid plans start
          later; we will tell you before anything changes.
        </p>
      )}

      <section aria-labelledby="learners-h" className="plan-group">
        <h2 id="learners-h">For learners</h2>
        <div className="plan-grid">
          {plans.direct.map((p) => (
            <article
              key={p.code}
              className={p.highlight ? "plan-card plan-best" : "plan-card"}
              aria-labelledby={`plan-${p.code}`}
            >
              {p.badge && <span className="plan-badge">{p.badge}</span>}
              <h3 id={`plan-${p.code}`}>{p.label}</h3>
              <p className="plan-price">
                <b>{money(p.pricePence)}</b> <span>{per(p.interval)}</span>
              </p>
              <p className="muted small">
                {p.kind === "one_off"
                  ? "Pay once, keep access to the course and its updates."
                  : `Full course access, cancel any time.`}
              </p>
              {p.interval === "year" && saving && (
                <p className="plan-save">
                  Save {saving}% · just {money(Math.round(p.pricePence / 12))} a month
                </p>
              )}
              <span className="plan-soon">Checkout opens soon</span>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="join-h" className="plan-group">
        <h2 id="join-h">Learning with a training centre?</h2>
        <p>
          If your centre gave you a join code, <Link href="/join">enter it here</Link> to get your
          place on the course.
        </p>
      </section>

      <section aria-labelledby="centres-h" className="plan-group">
        <h2 id="centres-h">For training centres</h2>
        <div className="plan-grid">
          <article className="plan-card" aria-labelledby="plan-licence">
            <h3 id="plan-licence">{l.label}</h3>
            <p className="plan-price">
              <b>{money(l.basePence)}</b> <span>a month</span>
            </p>
            <ul className="plan-points">
              <li>Your own branded learning site</li>
              <li>Includes {l.includedLearners} active learners a month</li>
              <li>Then {money(l.extraLearnerPence)} for each extra active learner</li>
              <li>You only pay for learners who studied that month</li>
            </ul>
          </article>
          <article className="plan-card" aria-labelledby="plan-seats">
            <h3 id="plan-seats">{plans.seatPack.label}</h3>
            <p className="plan-price">
              <b>{money(seatPackPrice(1).pencePerSeat)}</b> <span>a learner</span>
            </p>
            <ul className="plan-points">
              {tiers.slice(1).map((t) => (
                <li key={t.minSeats}>
                  {money(t.pencePerSeat)} a learner for {t.minSeats}+ places
                </li>
              ))}
              <li>{plans.seatPack.accessMonths} months of access per learner</li>
              <li>One join code for your students; charge them what you like</li>
            </ul>
          </article>
        </div>
        <p>
          <a
            className="btn primary"
            href={`mailto:${brand.supportEmail}?subject=Training%20centre%20plans`}
          >
            Talk to us about your centre
          </a>
        </p>
      </section>
    </main>
  );
}
