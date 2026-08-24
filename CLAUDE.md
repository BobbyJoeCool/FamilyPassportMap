# CLAUDE.md — Working Instructions for FamilyPassportMap

## Table of Contents

- [Purpose of This File](#purpose-of-this-file)
- [Bias Toward Asking Questions](#bias-toward-asking-questions)
- [Permission Rules](#permission-rules)
- [Code Documentation Standards](#code-documentation-standards)
- [Note-Taking Requirements](#note-taking-requirements)
- [Documentation Sync Requirements](#documentation-sync-requirements)
- [Diagram Sync Requirements](#diagram-sync-requirements)
- [Deployment and Testing Rules](#deployment-and-testing-rules)
- [Quick Reference — End of Phase Checklist](#quick-reference--end-of-phase-checklist)

## Purpose of This File

This file governs how Claude operates inside the FamilyPassportMap repository when working in VS Code via Claude Code. It is not part of the application — it is operating instructions for the assistant. Read this file at the start of every session before doing any work.

This project uses three kinds of documents that the rest of this file refers to:

- **Spec docs** — the functional specification for each build phase. One self-contained `.md` file per phase, in [`Documentation/`](Documentation/) (e.g. `Documentation/Phase-1-Data-Layer-People.md`). Each one is written to stand alone with zero repo access, so it can be designed in Claude Desktop and dropped back in.
- **Task doc** — the build plan and phase/version tracker: [`PHASES.md`](PHASES.md).
- **Narrative doc** — the project overview and usage guide: [`README.md`](README.md).

This file does not duplicate any of that — it governs *how* work gets done, not *what* gets built.

## Bias Toward Asking Questions

Default to asking clarifying questions before building anything where the spec is ambiguous, underspecified, or could reasonably be implemented more than one way — even when a step in `PHASES.md` looks straightforward on its face. Two or three extra questions are always preferable to building the wrong thing and having to redesign or unwind it later.

This applies even when a phase or step has been explicitly approved for implementation (see Permission Rules below) — approval to build a feature is not the same as approval for every micro-decision inside it. If the active phase's spec doc in `Documentation/` doesn't spell out an edge case, a field's exact validation rule, an error message's exact wording, or how two existing pieces of behavior should interact, ask rather than infer or assume.

A few concrete situations that should always trigger a question rather than a guess:

- The active phase's spec doc describes a behavior in general terms but a specific edge case (empty input, a boundary value, a conflicting state) isn't addressed
- Two previously documented rules appear to interact in a way that isn't explicitly resolved
- A database schema decision (nullable vs. required, a new field, a relation's cardinality) isn't directly dictated by the active spec doc
- A step in `PHASES.md` could reasonably be implemented two different valid ways and the choice has any downstream effect
- Anything that would require a structural change to already-built code if guessed wrong

When in doubt, ask. Silence in the spec is not permission to improvise — it's a sign the spec needs an answer first.

## Permission Rules

**No permission needed for:**
- Reading any file in the repository
- Reading or writing configuration files (`.gitignore`, `tsconfig.json`, `package.json`, and similar project config files)
- Creating directories
- Creating or editing any non-code file — this includes `.md` files, `.mmd` files, notes, and other documentation

**Permission needed for:**
- Editing or creating code files (`.ts`, `.tsx`, `.js`, `.jsx`, `schema.prisma`, SQL, etc.) — **unless** the current instruction explicitly asks for something to be implemented or built. If asked to complete a phase, a feature, or a step that involves writing code, that instruction itself is the permission — don't ask again before touching the code it covers.

In short: ask before code changes that weren't explicitly requested. Don't ask for anything else.

## Code Documentation Standards

This project documents code more heavily than is typical — this is a deliberate, standing choice for this repo, not a one-off request. Apply it every time code is written or edited here, on both the server (`apps/server`, TypeScript) and the client (`apps/web`, React/TSX), not just when explicitly asked to "add documentation."

- **Every function** — exported or internal, a route handler, a React component, a hook, a plain helper — gets a JSDoc comment above it: what it does, `@param` for each parameter, `@returns` where it returns something meaningful.
- **Conditionals** (`if`/`else`/`switch`/ternaries) get a short comment explaining what case is being handled and why, unless the condition is truly self-evident (e.g. a simple loading/error/empty guard clause).
- **Loops and iteration** (`for`, `while`, `.map`/`.filter`/`.reduce`/`.find` chains doing non-trivial work) get a comment describing what's being iterated and what the result is used for.
- **Variable definitions do not need their own comments.** Well-named variables (including React state) are self-explanatory — don't add a line describing what a variable holds just because it's a variable. But an individual line that *manipulates* a variable in a way that's confusing or ambiguous out of context (a mutation, a non-obvious reassignment, a side effect buried in an expression) still gets a short comment explaining what's happening and why.

Write the documentation as part of writing the code, not as an afterthought pass at the end.

## Note-Taking Requirements

**Every time a code file is edited or created, or any file is created, note it.**

Notes live in `DevNotes/Notes/`, one file per version, named after the version with its patch number dropped: `v<major>.<minor>.note.md`. Since every phase in this project ships as a `0.x.0` release (see `PHASES.md`), that gives:
- `DevNotes/Notes/v0.0.note.md` — Phase 0: setup/tooling work, and anything else that happens before the first version bump (including documentation scaffolding like this file)
- `DevNotes/Notes/v0.1.note.md` — Phase 1 (v0.1.0)
- `DevNotes/Notes/v0.2.note.md` — Phase 2 (v0.2.0)
- … one file per phase, following the same `v0.<phase>.note.md` pattern through Phase 7 (`v0.7.note.md`)
- `DevNotes/Notes/v1.0.note.md` — the v1.0.0 stabilization pass

Append entries within each file — don't overwrite. `DevNotes/` is gitignored: these notes are a local working record for you, not part of the committed project history.

Each note entry should include:
- What was created or changed (file path)
- A short description of why / what it does
- A timestamp or sequence marker within the session

**Also note, in the same file:**
- Any structural change to what the app does — meaning any change to behavior, data model, screen flow, or rules described in a phase's spec doc, not just routine implementation of what the spec doc already says. If a design decision changes mid-build (not just "building what was already specified"), it gets a note entry explaining the change and why.
- Any automatic update made to a spec doc in `Documentation/`, `PHASES.md`, `README.md`, or any `.mmd` diagram (see the next two sections) — note what was updated and why.

Routine, expected implementation work that matches the spec exactly doesn't need a novel-length entry — a clear one- or two-line description per file touched is sufficient. The bar for detail rises only when something deviated from or extended what was already documented.

## Documentation Sync Requirements

**After each phase or milestone is completed**, check that phase's spec doc in `Documentation/`, `PHASES.md`, and `README.md` against what was actually built. If the implementation diverged from what those documents describe — a structure changed, a rule got refined, a screen behaves differently than originally written — update the relevant document(s) to match reality.

This check does not require permission to act on. Make the update, then note it per the Note-Taking Requirements above.

If nothing diverged, no update is needed — don't edit a document just to have touched it.

## Diagram Sync Requirements

`Documentation/diagrams/ERD.mmd` is the **master entity-relationship diagram** for the whole database — the single source of truth for the current schema, not a per-phase snapshot. It must always reflect the schema exactly as it exists in `apps/server/prisma/schema.prisma` at that moment.

Two triggers, handled automatically, no permission required:

- **Any database structure change** (a Prisma model added/removed, a field added/removed/retyped, a relation added/changed, a new/changed unique constraint or cascade rule) → update `Documentation/diagrams/ERD.mmd` in the same piece of work, before considering the change done. This is not optional or batched for later — an out-of-date ERD is treated as a bug.
- **A user-facing flow changes** (steps, branches, screen transitions for any flow that has a corresponding diagram) → update the corresponding `.mmd` file in `Documentation/diagrams/`.

Diagrams used in this project (update this list as new ones are added):
- `Documentation/diagrams/ERD.mmd` — the master ER diagram for the Prisma schema (`Person`, `VisitedState`, and any models added in later phases). Until Phase 1 actually implements the schema in code, it documents the *planned* schema from `Documentation/Phase-1-Data-Layer-People.md`, clearly marked as such.

Do these updates as part of the same work that caused the change, not as a deferred cleanup step. Note each diagram update per the Note-Taking Requirements above.

## Deployment and Testing Rules

**All testing must be done locally.** Never start the application, run dev servers, or perform live testing against the Azure deployment. The deployed instance on Azure is production-only — do not attempt to connect to it, run it, or verify behavior against it. Use local dev servers (`npm run dev`, etc.) for all verification and testing.

## Quick Reference — End of Phase Checklist

When a phase from `PHASES.md` is marked complete:

1. Confirm every requirement in that phase's spec doc (`Documentation/Phase-N-*.md`) is actually done, including its acceptance criteria.
2. Diff actual behavior and structure against that spec doc, `PHASES.md`, and `README.md` — update any that drifted.
3. Confirm `Documentation/diagrams/ERD.mmd` reflects the current schema exactly.
4. Confirm any flow diagrams affected by this phase reflect current behavior.
5. Confirm the phase's spec doc has its "Decisions to carry forward" section accurate — the next phase's doc depends on it being correct.
6. Confirm the appropriate note file in `DevNotes/Notes/` (`v0.<phase>.note.md`) has an entry for every file created or edited during the phase, plus entries for any doc or diagram updates made in steps 2–5.
7. Bump the version per `PHASES.md`'s convention and update `CHANGELOG.md`.
