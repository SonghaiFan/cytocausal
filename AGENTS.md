# Working in cytocausal

## Documentation audiences

- When writing published guides, examples, API references or case studies in `apps/docs/src/content/`, follow [the documentation audience guide](docs/maintenance/documentation.md). Write for a reader building with the library or using an app, with no knowledge of development chats. Keep English and Chinese pages aligned.
- Put contributor workflows, implementation constraints and regression investigation notes in `CONTRIBUTING.md` or `docs/maintenance/`. Consult [historical rendering notes](docs/maintenance/historical-rendering-notes.md) when investigating transition cancellation, label collisions or earlier renderer measurements; verify them against current source before relying on them.
- Keep `AGENTS.md` focused on instructions for agents changing this repository. Product behaviour and API usage belong in the user guides; historical observations belong in maintenance references.

## Documentation verification

Check API and behaviour claims against their owning source. Distinguish reproducible current results from historical measurements. Preserve guide URLs when reorganising prose. For docs changes, run the content check and docs build from `apps/docs/package.json`; when changing runnable examples, also run the example checks described in `apps/docs/README.md`.
