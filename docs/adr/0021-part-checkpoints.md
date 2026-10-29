# ADR-0021: Part checkpoints (self-assessed now, scored question bank later)

- Status: accepted · Date: 2026-10-29 · Decider: Chief Architect, approved by product owner

## Context

The owner wants a test after each part. The handbook's interview questions have no answer keys, and we must not invent course content.

## Decision

- **Now:** a part checkpoint draws up to 10 interview questions from the part's chapters (deterministic shuffle per attempt) plus one decision drill from the part. The learner answers each question out loud or in writing and self-rates; **pass = at least 80 % rated "confident" and the drill answered**. Unsure questions link back to their chapter and enter the spaced-repetition queue. Attempts are unlimited; passing awards 200 XP once.
- A **part certificate** requires every published chapter in the part complete **and** the checkpoint passed.
- **Later (option 2):** an optional `content/questions/<course>/part-N.yaml` question bank (multiple choice with answer keys and explanations), imported like the handbook. When present for a part, the checkpoint uses scored questions instead of self-rating. The data model (`checkpoint_attempt(user_id, course, part, attempt, score, passed, created_at)`) supports both.
- **Not now:** AI-marked answers (brief lists the AI tutor as out of scope).
