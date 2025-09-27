# Development

## Code organization

This is a Next.js frontend:
- [`app/`](./app/) for routes
- [`components/`](./components/) for shared UI
- [`lib/`](./lib/) for backend-generated types
- Static assets live in [`public/`](./public/)
- Compiled output in [`out/`](./out/) should stay untouched.

## Commands

You will need access to the `videoclub-test` GCP bucket to run the website.

- `pnpm dev`: start the Next.js dev server.
- `pnpm lint`: run ESLint with the Next.js + Prettier flat config.
- `pnpm format:check`: ensure Prettier formatting prior to commit.
- `pnpm build`: compile the frontend exactly as the CI build.

## Coding style & conventions

Defaults are camelCase for variables, PascalCase for React components, and colocating related `.ts`/`.tsx` files with their styles. Let Prettier handle whitespace via `pnpm format` rather than manual tweaks.

# Cloud

Deploy to Firebase manually:
```bash
firebase deploy --project=${_FIREBASE_PROJECT_ID} --only=hosting
```

An automatic rebuild and deploy of this website is triggered whenever we push on the main branch of the Github repo, and whenever the [`extractor`](../extractor/README.md) pipeline decides to trigger a build.

See [cloudbuild.yaml](./cloudbuild.yaml) to see how the website is built on Google Cloud Build.

See [website-rebuild-automation-setup.md](../docs/website-rebuild-automation-setup.md) to set up the full ecosystem.