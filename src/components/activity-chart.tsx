"use client";

// This week's XP per day (one series, so no legend; the heading names it). Today's bar is
// solid accent, other days a lighter step of the same hue (both ≥ 3:1 against the card).
// Values: direct labels on today and the best day only; every bar has a hover/focus
// tooltip, and a table carries the same numbers for screen readers.
import { useState } from "react";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ActivityChart({
  days,
  today,
}: {
  days: { day: string; xp: number }[];
  today: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.xp), 0);
  const scale = max > 0 ? max : 1;
  const best = max > 0 ? days.findIndex((d) => d.xp === max) : -1;
  const total = days.reduce((n, d) => n + d.xp, 0);

  return (
    <figure className="activity" aria-labelledby="activity-h">
      <figcaption className="activity-total">
        <b>{total}</b> XP this week
      </figcaption>
      <div className="activity-plot" aria-hidden="true">
        {days.map((d, i) => {
          const isToday = d.day === today;
          const show = hover === i || (hover === null && (isToday || i === best) && d.xp > 0);
          return (
            <div
              key={d.day}
              className={`activity-col${isToday ? " today" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="activity-track">
                {show && (
                  <span className="activity-value" style={{ bottom: `${(d.xp / scale) * 100}%` }}>
                    {d.xp} XP
                  </span>
                )}
                <div
                  className={`activity-bar${d.xp > 0 ? "" : " empty"}`}
                  style={d.xp > 0 ? { height: `max(6px, ${(d.xp / scale) * 100}%)` } : undefined}
                />
              </div>
              <span className="activity-day">{DAY[i]}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>XP earned each day this week</caption>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.day}>
              <th scope="row">
                {FULL[i]}
                {d.day === today ? " (today)" : ""}
              </th>
              <td>{d.xp} XP</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
