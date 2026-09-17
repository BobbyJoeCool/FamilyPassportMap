# FamilyPassportMap — Phase Plan

This is the build plan and version tracker for FamilyPassportMap. Each phase after initial setup ships as a `0.x.0` release; once every phase below is built and stabilized, that stabilization pass ships as `1.0.0`. The post-v1.0 World round (Phases 8–11) follows the same pattern one level up: each phase ships as `1.x.0`, and its stabilization pass ships as `2.0.0`.

Each phase has a matching self-contained design spec in [`Documentation/`](Documentation/) — written so it can be handed to a fresh Claude Desktop session with **no repo access** and still make sense. Every spec doc opens with the decisions it inherits from earlier phases and closes with the decisions the next phase must inherit from it.

| Phase | Version | Name | Spec doc | Status |
|---|---|---|---|---|
| 0 | — (pre-release) | Environment & Tech Stack Setup | [Documentation/Phase-0-Environment-Setup.md](Documentation/Phase-0-Environment-Setup.md) | **Complete** |
| 1 | v0.1.0 | Data Layer & People Management | [Documentation/Phase-1-Data-Layer-People.md](Documentation/Phase-1-Data-Layer-People.md) | **Complete** |
| 2 | v0.2.0 | Interactive Map (Single-Person View) | [Documentation/Phase-2-Interactive-Map.md](Documentation/Phase-2-Interactive-Map.md) | **Complete** |
| 3 | v0.3.0 | Compare View (Side-by-Side) | [Documentation/Phase-3-Compare-View.md](Documentation/Phase-3-Compare-View.md) | **Complete** |
| 4 | v0.4.0 | List View | [Documentation/Phase-4-List-View.md](Documentation/Phase-4-List-View.md) | **Complete** |
| 5 | v0.5.0 | Responsive Design & PWA Packaging | [Documentation/Phase-5-Responsive-PWA.md](Documentation/Phase-5-Responsive-PWA.md) | **Complete** |
| 6 | v0.6.0 | Azure Deployment Pipeline | [Documentation/Phase-6-Azure-Deployment.md](Documentation/Phase-6-Azure-Deployment.md) | **Complete** |
| 7 | v0.7.0 | Polish, Validation & Hardening | [Documentation/Phase-7-Polish-Hardening.md](Documentation/Phase-7-Polish-Hardening.md) | **Complete** |
| — | **v1.0.0** | **Official Release** | (no separate spec doc — a stabilization pass over Phase 7's output) | **Complete** |
| — | v1.1.0 | Visited-State Counter | (no spec doc — small, self-contained addition, by explicit agreement with the user) | **Complete (v1.1.0 shipped)** |

## Post-v1.0 round: World Map & Countries (→ v2.0.0)

A second, parallel tracking system — countries visited, on a world map zoomed one continent at a time — mirroring the US Map/Compare/List experience as its own independent "World" section. Design rationale and the decisions behind it: [`DevNotes/Plans/v2.0-World-Map-Countries.md`](DevNotes/Plans/v2.0-World-Map-Countries.md) (approved 2026-09-16). Each phase below still gets its own self-contained spec doc, per the versioning convention's rule for larger scope.

| Phase | Version | Name | Spec doc | Status |
|---|---|---|---|---|
| 8 | v1.2.0 | World Data Layer & Countries API | [Documentation/Phase-8-World-Data-Layer.md](Documentation/Phase-8-World-Data-Layer.md) | **Complete (v1.2.0 shipped)** |
| 9 | v1.3.0 | World Map (continent zoom) | [Documentation/Phase-9-World-Map.md](Documentation/Phase-9-World-Map.md) | **Complete (v1.3.0 shipped)** |
| 10 | v1.4.0 | World Compare & World List | [Documentation/Phase-10-World-Compare-List.md](Documentation/Phase-10-World-Compare-List.md) | **Complete (v1.4.0 shipped)** |
| 11 | v1.5.0 | World Polish & Hardening | [Documentation/Phase-11-World-Polish-Hardening.md](Documentation/Phase-11-World-Polish-Hardening.md) | **Complete (v1.5.0 shipped)** |
| — | **v2.0.0** | **World Release** | (no separate spec doc — a stabilization pass over Phase 11's output) | **Complete** |

## Versioning convention

- **Phase 0** is environment/tooling setup only — no user-facing behavior, so it doesn't get its own `0.x.0` tag.
- **Phases 1–7** each ship as `0.<phase>.0` when their acceptance criteria are met.
- **v1.0.0** is not a new phase — it's the point where Phase 7's output has been walked through end-to-end, every spec doc matches what was actually built, and nothing new is being added. No new features get designed under the `1.0.0` label; a `1.1.0`+ would start a new round of phase docs for post-v1 scope (countries/world map, auth, blended compare view, etc.).
- **Phases 8–11** (the World round) each ship as `1.<phase − 6>.0` (v1.2.0–v1.5.0), and **v2.0.0** is their stabilization pass, same rules as v1.0.0.
- Not every post-v1.0 addition needs a full Phase-N spec doc — a small, self-contained feature (like the v1.1.0 state counter) can skip straight to a Version/Name/Status row here if the user agrees. Larger scope (countries/world map, auth, blended compare) should still get a proper spec doc in `Documentation/` before it's built.

## Explicitly out of scope for v1.0.0

These came up during initial design and were deliberately deferred, not forgotten:
- Countries / world map support — **no longer deferred**: picked up as the post-v1.0 round above, starting with Phase 8
- Login / authentication / multi-household accounts
- Blended/overlap coloring in Compare view (v1 renders separate maps side by side)
- Native desktop packaging (Electron) — v1 is a responsive, installable PWA hosted on Azure instead

## Status legend

`Not started` → `In progress` → `Built, pending verification` → `Complete (vX.X.0 shipped)`
