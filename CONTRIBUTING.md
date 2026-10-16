# Contributing

Opening an issue is enough to contribute. You do not need to write code or submit a pull request. Bug reports, rules corrections, translation fixes, and suggestions help improve Sideline.

I maintain this project in my spare time. Pull requests are welcome, but I am not committing to reviewing or merging them in a timely fashion. An issue or pull request may remain unanswered, and submitting a change does not guarantee it will be merged.

## Open an issue

Use the [issue tracker](https://github.com/martinAbsolute/blood-bowl-sideline/issues).

For bugs, describe what you did, what you expected, and what happened. Include reproduction steps and relevant screenshots, browser details, or roster settings. Remove tokens, private account data, and other secrets.

For rules corrections, include the rules edition, competition preset, and a source for the correction. For translation fixes, include the language and where the text appears.

## Submit a pull request

For a large change, open an issue first to discuss its scope. This can save work, though I cannot promise a response.

1. Fork the repository and create a branch for your change.
2. Follow the [local setup instructions](README.md#run-locally) and [development notes](docs/development.md). Use your own development deployment.
3. Read `AGENTS.md`. For Convex changes, read `convex/_generated/ai/guidelines.md`. For Next.js changes, read the relevant guides under `node_modules/next/dist/docs/`.
4. Keep the change focused. Update both English and Ukrainian translations when changing user-facing text. Consult [rules sources](docs/rules-sources.md) before changing game data.
5. Run the checks below. Add or update tests when behavior changes.
6. Explain the problem, your change, and how you checked it in the pull request. Include screenshots for UI changes and note any checks you could not run.

```sh
pnpm format:check
pnpm check
pnpm test
pnpm build
```

Do not commit environment files, credentials, deploy keys, or signing keys. Do not deploy changes to the project's production services.

## License and artwork

Contributions to original code and documentation use the project's [AGPL-3.0-only license](LICENSE). Preserve existing copyright and license notices. For third-party artwork, include its attribution and license or permission information where known. See [ATTRIBUTION.md](ATTRIBUTION.md).
