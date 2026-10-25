# Specs stay in Documentation/, tickets go to GitHub Issues

Starting with the login feature (Phase 12), a phase's spec is still written as a self-contained `Documentation/Phase-N-*.md`, which can be designed in Claude Desktop without the repo. Its implementation tickets are GitHub issues, linked from that spec and from the phase's `PHASES.md` row. We kept the spec local because the whole doc workflow in `.claude/CLAUDE.md` (documentation sync, decisions to carry forward) depends on it. Tickets moved to GitHub so they get native blocking links and a clear next task for `/implement`.

## Considered Options

- **All in GitHub**: spec as an issue. Rejected: it breaks the standalone spec-doc workflow and the doc-sync checklist.
- **All local, as for Phases 1–11**: rejected: there are no blocking links, and `/to-tickets` and `/implement` can't track progress.
