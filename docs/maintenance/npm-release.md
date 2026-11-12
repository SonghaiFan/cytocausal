# npm release preparation

The primary product is the React library. Private source workspaces remain unchanged for local development. Release scripts produce separate publishable packages; never publish the source workspace directories directly.

## Build and verify

Run from the repository root:

    npm ci
    npm run release:pack
    npm run release:verify

The pack command compiles core, cytoscape, then react. It emits ESM JavaScript, declarations and CSS, preserves React client directives, rewrites TypeScript import/worker URL extensions, and bundles workers with their runtime dependencies. No application, case-study data, test fixture or source workspace is included.

Output:

- .release/packages/: staged publishable packages.
- .release/tarballs/: npm archives and an integrity/size manifest.
- .release/verification.json: written only after consumer checks pass.

Version and npm tag are defined in scripts/release/config.json. Internal release dependencies use that exact version. Cytoscape.js 3.31.0 is a peer shared with the host; React is a peer of the React package. Cytoscape type declarations are package dependencies because public declarations reference them. Layout registration is intentionally marked side-effectful.

Verification creates projects outside the repository in temporary directories. It installs archives (not workspace links), checks the core runtime and declarations with skipLibCheck=false, builds Vite and Next.js consumers, then checks editing, undo/redo, styles and successful layout/loop worker results in a browser. Next's production build uses its normal skipLibCheck setting after the independent declaration check. Graphs use a client-only boundary in Next.js. There are no source aliases or transpilePackages settings.

Vite development is checked as well as production. Dependency optimization differs from production bundling; self-contained workers avoid relying on consumer-specific transforms of layout extensions.

.github/workflows/packages.yml runs the same checks and uploads archives. It has read-only repository permissions and does not publish.

## Before the first public alpha

1. Verify ownership and publish access for the @cytocausal scope and all three names. The local build has not verified this.
2. Review manifests, README files, license notices and archive file lists. Initial output is ESM-only, React 19, Cytoscape.js 3.31.0; the editor uses English and a light theme.
3. Commit reviewed source and choose the release version. Rebuild and verify from that revision. Keep the resulting archives unchanged; verification records their integrity.
4. Establish npm authentication and first-publication setup. Subsequent CI publication can use trusted publishing bound to a specific release workflow. The current workflow is not a publisher.
5. Publish the verified core archive, then cytoscape, then react, using public access and the next tag. Do not promote an alpha to latest.
6. Verify installation from the registry, create release notes/tag for the same source revision, and update public installation instructions.

No publication, namespace reservation, authentication setup, git tag or release is performed by these scripts.

## Recovery and limitations

A published version cannot be overwritten. Deprecate a faulty alpha and publish a new version; repair the next tag if necessary. For partial three-package publication, check existing registry versions and archive integrity before continuing.

There is no CommonJS/UMD distribution or framework-independent authoring API. Layouts are currently registered eagerly, so the full editor includes them; on-demand layouts are a separate optimization. Consumer checks cover the pinned fixture versions, not every bundler or framework version.
