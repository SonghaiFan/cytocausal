# Contributing

Thanks for helping out.

## Set up

Follow the quick start in the [README](README.md).

## Make a change

1. Create a branch from `main`.
2. Make your change, with tests if it changes behaviour.
3. Run the checks below.
4. Open a pull request saying what changed and why.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests need Chrome and a production build. `npm test` also checks the real datasets when you have them. Set `CYTOCAUSAL_PERSPECTIVA` and `CYTOCAUSAL_EXPLORER` to their project folders, or those tests are skipped.

## Where code goes

- **`packages/`** is for anything apps can share. Keep `core` free of UI code.
- **`apps/`** is for anything specific to one app.
- If you're not sure, start in the app and move it to a package once a second app needs it.

## Docs

Guides are in `apps/docs/src/content`. Update both `en` and `zh-cn` when you change one.

## Data

Datasets have their own terms, so read [DATA.md](DATA.md) first. Don't commit the full ACCESS benchmark: `apps/explorer/public/dataset.json` must stay a sample, and a test checks this.
