# Independent applications

ACCESS and Perspectiva were extracted from Cytocausal commit `e3c8c8fbef81a8a3c40dff539c02c8cccef9abf4` with `git subtree split`, preserving each application’s commit history.

| Application | Repository | Production | Vercel project ID |
| --- | --- | --- | --- |
| ACCESS Explorer | https://github.com/SonghaiFan/access | https://access.songhai.site | prj_CUvDQcDfaW1SWMy9GcXKchU3fg70 |
| Perspectiva | https://github.com/SonghaiFan/perspectiva | https://perspectiva.songhai.site | prj_gPVQADKZkIGNVDUznXtFkW8y8xBf |

Both apps install compiled `@cytocausal/core`, `@cytocausal/cytoscape` and `@cytocausal/react` packages from the immutable `v0.1.0-alpha.1` GitHub Release. npm overrides keep transitive packages on those same archives; lockfiles record package integrity. No local workspace, sibling checkout, or copied library source is required. npm authentication was unavailable during extraction, so this release uses GitHub distribution rather than claiming npm publication.

The release packages are built by `npm run release:pack`. To update an application, publish a new version without replacing existing assets, update all three dependency URLs and regenerate its lockfile, then run typecheck, production build and browser tests before deployment. Once npm publication is configured, switch all three dependencies and their transitive resolution together.

Dataset files and original browser tests were retained. ACCESS changes its displayed name and metadata; both apps default their documentation link to the public Cytocausal site. Runtime graph functionality stays in the shared library. The previous Vercel project IDs and domain aliases remain attached to the respective applications.
