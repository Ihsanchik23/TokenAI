<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TokenAI interface rules

- Do not expose browser- or operating-system-default controls in the product UI. Visible inputs, selectors, menus, dialogs, and other interactive blocks must use the TokenAI brand styling on every platform.
- After a completed project change passes its relevant checks, deploy it by applying pending database migrations, pushing the committed change to `main`, and verifying the production deployment.
