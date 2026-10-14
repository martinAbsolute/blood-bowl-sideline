# Stable dependency update — 14 October 2026

All 52 direct dependencies were checked against npm registry `latest` metadata. Twenty declarations had newer releases; the other 32 were already current. After installation, every direct package's actual version matched its verified stable release. No canary, alpha, beta or release-candidate version was selected for a direct dependency. The existing TypeScript aliases continue to use the stable TypeScript 6 maintenance compiler and TypeScript 7 native package.

pnpm was updated from 12.9.1 to 12.11.2, with the npm tarball's SHA-512 integrity in `packageManager`. The lockfile was refreshed and a frozen installation passed. The existing Convex Auth patch was preserved and its installed OAuth URL changes were inspected. Convex and its auth/presence components already matched their latest stable releases.

| Package                | Previous declaration | Updated declaration |
| ---------------------- | -------------------- | ------------------- |
| @base-ui/react         | ^1.8.0               | ^1.9.0              |
| @types/node            | ^26.6.4              | ^26.6.5             |
| convex-test            | ^0.0.60              | ^0.0.61             |
| eslint-config-next     | ^16.3.8              | ^16.4.0             |
| gt                     | ^2.25.1              | ^2.26.5             |
| gt-next                | ^11.4.9              | ^11.4.12            |
| happy-dom              | ^20.14.5             | ^21.0.1             |
| lucide-react           | ^1.52.0              | ^1.57.0             |
| motion                 | ^14.0.0              | ^14.2.0             |
| next                   | ^16.3.8              | ^16.4.0             |
| postcss                | ^8.5.29              | ^8.5.30             |
| prettier               | ^3.9.9               | ^3.9.10             |
| react                  | ^19.3.0              | ^19.3.1             |
| react-dom              | ^19.3.0              | ^19.3.1             |
| react-hook-form        | ^7.89.0              | ^7.90.0             |
| react-resizable-panels | ^4.14.2              | ^4.14.5             |
| shadcn                 | ^4.21.2              | ^4.21.5             |
| vite                   | ^8.3.2               | ^8.3.4              |
| vitest                 | ^5.0.3               | ^5.0.4              |
| zod                    | ^4.6.5               | ^4.6.7              |

## Compatibility fixes

- The footer now uses a default JSON import for the package version, removing the production bundler warning.
- The Android Back test's CloseWatcher mock now models the browser's cancel-then-close sequence. Base UI 1.9 handles the cancel event; the previous test dispatched only close. The existing repeated-open/close and resting-bar assertions still pass.
- The translation CLI pins `@clack/prompts@1.0.0-alpha.6`. A scoped `gt>@clack/prompts` override selects stable 1.8.1 instead. The CLI help command successfully loads with the replacement.
- Installing the locked packages resolved the old local COBE 0.6.5 versus declared 2.0.1 mismatch. No globe-component migration was needed.

pnpm recorded exact-version release-age exceptions for the newly requested stable releases in `pnpm-workspace.yaml`. Its lockfile supply-chain verification passed. The existing `@eslint/compat` configuration continues to make the current ESLint plugins work with ESLint 10. Three upstream plugin peer declarations still stop at ESLint 9; the full lint check passes, and their declarations were not suppressed or rewritten.

## Babel and browser output

The dependency graph (`pnpm why @babel/core gensync`) traces Babel to GT's translation CLI, shadcn's code generator, React Hooks linting, and Next.js's styled-jsx tooling. These dependencies parse and transform source code; their presence does not establish that polyfills are included in application browser chunks. The production build uses Turbopack and SWC. This project's GT compiler setting uses the package's default `type: "none"`, with local dictionaries.

The exported production analyzer graph, captured with `next analyze --output --snapshot stable-upgrade`, covers all 25 route definitions. Its 1,687 app-client module records contain **zero modules from Babel (including runtime helpers), gensync, core-js or regenerator-runtime**. Module matching uses real package paths, not the pnpm directory names that embed Babel's peer version.

Next.js separately generates a framework compatibility file, referenced by `polyfillFiles` and emitted as `<script ... noModule="">`. Modern browsers skip that script. This is the framework's normal conditional fallback, not an app-imported polyfill. The project does not add a custom Babel configuration or polyfill import.

An unavoidable tooling exception remains: Babel's required `gensync@1.0.0-beta.2` has no compatible stable release (the registry's latest tag is itself beta). It remains an upstream tooling dependency and contributes no app-client modules. Replacing it with an incompatible version solely to remove the label would risk the compiler without reducing browser payload.

## Verification

- All 1,011 tests passed with the updated dependencies.
- Typechecking, ESLint and the full project formatting check passed.
- The default Next.js 16.4.0 Turbopack production build passed without the footer warning.
- Frozen lockfile installation and GT CLI help passed.
- Local production browser inspection confirmed the star-rule badges and localized reference page.

The analyzer snapshot is generated under `.next/diagnostics/analyze` and is intentionally excluded from Git. Reproduce it with the analyzer commands above.
