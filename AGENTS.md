# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint with the Tailwind directives and design tokens
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React and Figma Make plugins plus the `@` alias for `src`
- `tailwind.config.ts`, `postcss.config.js` - Tailwind CSS v3 configuration
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 18 and React DOM 18
- Styling: Tailwind CSS v3 through PostCSS, with shadcn/ui components
- Build tooling: Vite 5, TypeScript 5.7, and `@vitejs/plugin-react`
- Package manager: pnpm only (`pnpm-lock.yaml`)
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v3**, configured in `tailwind.config.ts` and run through PostCSS. Use Tailwind utility classes directly in JSX and put global CSS and design tokens in `src/index.css`.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
