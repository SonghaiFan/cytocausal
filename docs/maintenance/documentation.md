# Documentation audiences

This guide is for contributors and agents maintaining repository documentation.

| Location | Reader | Content |
| --- | --- | --- |
| `apps/docs/src/content/{en,zh-cn}/` | Library integrators and app users | Tasks, runnable examples, API contracts, current behaviour, limitations and troubleshooting |
| `README.md` | Prospective users and contributors | Project purpose, entry points and current availability |
| `CONTRIBUTING.md`, `apps/*/README.md`, `docs/deployment/` | Contributors and operators | Setup, checks, repository workflows and deployment |
| `docs/maintenance/` | Maintainers investigating or changing implementation | Design rationale, regression context and evidence with its limits |
| `docs/PLAN.md` | Project contributors | Planned work and project status |
| `AGENTS.md`, scoped `apps/*/AGENTS.md` | Coding agents | Work instructions and conditional pointers to relevant references |

## Writing published pages

Lead with the reader's task and the current interface. Explain an implementation detail when it helps the reader configure, integrate or troubleshoot the library. A developer using the library is still a user; technical depth alone does not make a page an agent document.

Replace development chronology with current behaviour. For example, “an earlier version rebuilt the graph every time” becomes “enable `animateSnapshots` to preserve node continuity between versions.” Keep the regression history in a maintenance reference only if it helps future diagnosis.

Keep agent instructions, development-chat replies, implementation checklists and statements about completed work outside published pages. Case studies should describe the data, user tasks, integration choices and observable behaviour. Test files and one-off validation reports belong in contributor references.

Publish measurements only with enough context to interpret and reproduce them: data, environment, method and date or revision. Historical numbers with missing context are evidence for investigation, not product guarantees.

## Reviewing a change

1. Identify the reader and the task each section supports.
2. Check current API claims against source. Retain useful limitations and integration guidance.
3. Move maintenance-only material outside `apps/docs/src/content/`; keep published routes stable.
4. Update both languages and check code examples for parity.
5. Run content checks and a docs build. When example code changes, run the relevant example checks as well.

The docs site's navigation and search cover published content only. Repository maintenance references are linked from contributor documentation and agent instructions.
