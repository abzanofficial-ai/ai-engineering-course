# ADR-0033: Visitors' progress is kept on their device and moves into their account

- Status: accepted · Date: 2026-11-05 · Decider: Chief Architect, with the product owner
- Amends ADR-0009 (progress ops and outbox). Bug report: signed-out readers pressed "Mark as
  read" and nothing was saved; the same steps worked when signed in.

## Context

The public pages ("How to use this book", "The capstone", Chapter 1) are readable without an
account. The client dropped every progress action from a visitor: reading silently, and ticks or
answers after showing the sign-up prompt. Visitors saw their work disappear.

## Decision

- A visitor's reading, lab ticks, commits, drill answers and place in the chapter are kept in
  `localStorage` under `outbox:<course>:guest` (capped at 500 actions, only the latest position
  kept). This is storage the visitor asks for by pressing the buttons, not tracking.
- The route, the chapter, the Learn header and the home card show that progress, labelled
  "Saved on this device". The first tick or answer shows the sign-up prompt once per page view;
  reading never does.
- Ratings, notes, bookmarks and the weekly goal still need an account.
- On sign-in the visitor's actions are moved (oldest first) into the learner's outbox and sent
  to `/api/me/ops`, which validates and scores them like any other; the visitor store is then
  emptied. Sign-out clears it with the rest of the learner's local data, so a shared device
  starts clean for the next person.
- Actions taken before the app knows whether the reader is signed in are held and replayed once
  it does, instead of being dropped.
- If storage is unavailable, progress still works in memory for the current page view.

## Consequences

- Reading done before signing up earns XP on the day it is synced, not the day it happened.
- On a shared device, a visitor's progress joins whichever account signs in next on it.
