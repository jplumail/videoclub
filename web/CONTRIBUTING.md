## Coding style & conventions

Defaults are camelCase for variables, PascalCase for React components, and colocating related `.ts`/`.tsx` files with their styles. Let Prettier handle whitespace via `pnpm format` rather than manual tweaks.

## CI checks

Commands mandatory to run to pass CI:
- `pnpm lint`
- `pnpm run format:check`
