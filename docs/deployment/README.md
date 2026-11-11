# Production deployment

- Library site: https://songhaifan.github.io/cytocausal/
- Studio: https://cytocausal-studio.vercel.app
- Perspectiva: https://cytocausal-perspectiva.vercel.app
- Explorer: https://cytocausal-explorer.vercel.app

## GitHub Pages

GitHub Pages is built from `main` by `.github/workflows/pages.yml`. Every push checks the bilingual content and example sources, builds the static site, and deploys `apps/docs/out/`. Repository Settings → Pages uses GitHub Actions. The earlier `gh-pages` branch is retained as publication history; it is no longer the deployment source.

Build from the repository root:

```sh
NEXT_PUBLIC_BASE_PATH=/cytocausal \
NEXT_PUBLIC_STUDIO_URL=https://cytocausal-studio.vercel.app \
NEXT_PUBLIC_PERSPECTIVA_URL=https://cytocausal-perspectiva.vercel.app \
NEXT_PUBLIC_EXPLORER_URL=https://cytocausal-explorer.vercel.app \
npm run build -w @cytocausal/docs
```

To publish, commit and push to `main`, then check the **Deploy library site to GitHub Pages** workflow. It can also be started manually with `workflow_dispatch`. Only the built static output is uploaded; private datasets and source environment files are not part of that artifact.

## Vercel

Three projects use the same repository with root directories `apps/studio`, `apps/perspectiva`, and `apps/explorer`. All use Node 22, `npm install`, `npm run build`, and include source files outside the root directory so workspace packages resolve.

`NEXT_PUBLIC_DOCS_URL` is `https://songhaifan.github.io/cytocausal/en/` for Studio, and `https://songhaifan.github.io/cytocausal` for the cases (which append their chapter path).

The projects are linked to `SonghaiFan/cytocausal`; pushes to `main` deploy committed source to production. For a manual deployment of the current checkout, use the Vercel CLI. `.vercelignore` excludes environment files, build artifacts, and Explorer's non-public full dataset. Run from the repository root with the appropriate project ID:

```sh
VERCEL_ORG_ID=team_PFsO3L7gyf94GAVgLRWFOS26 \
VERCEL_PROJECT_ID=<project-id> \
vercel deploy --prod --yes --scope songhaifans-projects
```

| Application | Project ID |
| --- | --- |
| Studio | prj_xenbDaNDg8fDLDYeGigbeQTjPytu |
| Perspectiva | prj_gPVQADKZkIGNVDUznXtFkW8y8xBf |
| Explorer | prj_CUvDQcDfaW1SWMy9GcXKchU3fg70 |

After publishing, confirm that each production deployment references the pushed commit. Manual CLI deployments should use a clean checkout of that commit. Studio currently persists graph data in the current browser only; JSON export is the portable backup.
