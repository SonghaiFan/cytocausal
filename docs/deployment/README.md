# Production deployment

- Library site: https://cytocausal.songhai.site/
- Studio: https://cytocausal-studio.songhai.site
- Perspectiva: https://perspectiva.songhai.site
- Explorer: https://access.songhai.site

## GitHub Pages

GitHub Pages is built from `main` by `.github/workflows/pages.yml`. Every push checks the bilingual content and example sources, builds the static site, and deploys `apps/docs/out/`. Repository Settings → Pages uses GitHub Actions. The earlier `gh-pages` branch is retained as publication history; it is no longer the deployment source.

Build from the repository root:

```sh
NEXT_PUBLIC_BASE_PATH= \
NEXT_PUBLIC_STUDIO_URL=https://cytocausal-studio.songhai.site \
NEXT_PUBLIC_PERSPECTIVA_URL=https://perspectiva.songhai.site \
NEXT_PUBLIC_EXPLORER_URL=https://access.songhai.site \
npm run build -w @cytocausal/docs
```

To publish, commit and push to `main`, then check the **Deploy library site to GitHub Pages** workflow. It can also be started manually with `workflow_dispatch`. Only the built static output is uploaded; private datasets and source environment files are not part of that artifact.

## Vercel

Studio uses `SonghaiFan/cytocausal` with root directory `apps/studio`, Node 22, `npm install`, `npm run build`, and source files outside the root enabled for workspace packages.

ACCESS and Perspectiva are independent applications:

| Vercel project | Repository | Root | Install | Build |
| --- | --- | --- | --- | --- |
| access | SonghaiFan/access | repository root | `npm ci` | `npm run build` |
| perspectiva | SonghaiFan/perspectiva | repository root | `npm ci` | `npm run build` |

Both use Node 22 and versioned Cytocausal GitHub Release dependencies with lockfile integrity. They do not require source files outside the project root. The existing Vercel project IDs and previous domain aliases are retained.

`NEXT_PUBLIC_DOCS_URL` is `https://cytocausal.songhai.site/en/` for Studio, and `https://cytocausal.songhai.site` for the cases (which append their chapter path).

Each project follows `main` in its own repository; pushes deploy committed source to production. For a manual deployment of the current checkout, use the Vercel CLI. `.vercelignore` excludes environment files and build artifacts. Run from the repository root with the appropriate project ID:

```sh
VERCEL_ORG_ID=team_PFsO3L7gyf94GAVgLRWFOS26 \
VERCEL_PROJECT_ID=<project-id> \
vercel deploy --prod --yes --scope songhaifans-projects
```

| Application | Project ID |
| --- | --- |
| Studio | prj_xenbDaNDg8fDLDYeGigbeQTjPytu |
| Perspectiva | prj_gPVQADKZkIGNVDUznXtFkW8y8xBf |
| ACCESS | prj_CUvDQcDfaW1SWMy9GcXKchU3fg70 |

After publishing, confirm that each production deployment references the pushed commit. Manual CLI deployments should use a clean checkout of that commit. Studio currently persists graph data in the current browser only; JSON export is the portable backup.
