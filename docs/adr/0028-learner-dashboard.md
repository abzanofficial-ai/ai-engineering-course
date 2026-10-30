# ADR-0028: A learner dashboard is the home page

- Status: accepted · Date: 2026-10-30 · Decider: Senior UI/UX Designer, with Chief Architect

## Context

`/` redirected straight to the one course. The owner wants a home that lists every course a
learner can take, so new courses (and, later, subscribed or purchased ones) appear in one place.

## Decision

- `/` is a static dashboard: a side navigation (a scrolling row on phones), a card per course and,
  when signed in, this week's streak, XP, learning days and questions due.
- **Courses come from `content/courses.json`.** Each entry may add `level`, `summary` and `icon`
  (`route | brain | prompt | blocks`) for its card. Card text must quote or follow the course's
  own wording; we do not write marketing copy for a course.
- Progress per card uses the same maths as the learning path (the average of the parts). The
  default course uses the learner state already loaded; any other course fetches its own state
  from `/api/me/state` (tenant- and user-scoped as before).
- "Start course" opens the course's learning path; "Continue" opens the last page visited.
- Certificates show as "soon" until M5.
- The brand link and the installed app's start URL now go to `/`.

## Later

- **M5 (entitlements):** cards are filtered to courses the learner is entitled to, with locked
  cards for courses they can buy.
- **Phase 2:** the list is filtered by the tenant's `tenant_course` rows and branded per host.
