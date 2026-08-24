# Follow-up: TypeScript-accurate `filename`/`line` in the logs table

Not yet implemented. This is a note to pick the work back up, possibly on a different
machine - see issue #303 for the shipped part of this work (structured `context` +
compiled-location `filename`/`line`).

## Where things stand

The `logs` table (`packages/electron/src/db.ts`) has nullable `filename`/`line` columns,
populated by both `packages/electron/src/logger.ts` (main process) and
`packages/app/src/app/renderer-logger.ts` (renderer) via a shared technique: capture
`new Error().stack` inside the patched `console.*` wrapper and parse the caller's stack
frame (`at name (file:line:col)`) with a regex.

That gives a real location, but it's the **compiled/bundled** location - e.g.
`main.js:471` for the renderer, or a `dist/electron/*.js` path for the main process - not
the original `.ts` file and line. Neither build currently emits source maps:

- `packages/electron/tsconfig.json` has no `sourceMap` option (defaults to `false`).
- `packages/app/angular.json` only sets `"sourceMap": true` under the `development`
  configuration; the `production` configuration (what `npm run build`/`build:ui` actually
  uses for a packaged app) doesn't set it.

So even the compiled-location value comes from the packaged app; it just isn't TS-accurate.

## What resolving it actually requires

This is real scaffolding, not a small addition on top of the shipped work - see the
conversation that led to issue #303 for the full reasoning. In short:

1. **Enable source map generation for both builds.**
   - `sourceMap: true` in `packages/electron/tsconfig.json`.
   - Add `"sourceMap": true` to the `production` configuration in
     `packages/app/angular.json` (currently only `development` sets it).
   - No public-facing security concern here - this is a desktop app shipping as an asar,
     not a public web server leaking source.

2. **Make sure the `.map` files actually ship with the packaged app.**
   - Electron's own compiled output already lands its `.map` files next to the `.js` in
     `packages/electron/dist/` - nothing extra needed there.
   - The Angular build's maps need to stay inside `dist/bitbutler/**`, which is already
     globbed into the `files` list in the `build` config in `package.json` - just make sure
     nothing filters them out.

3. **Resolve server-side, at insert time, in the main process.**
   - Use a source-map resolution library (e.g. `source-map` or `@jridgewell/trace-mapping`).
   - For a main-process log row: load the `.map` next to the compiled `.js` that produced
     the frame.
   - For a renderer log row (arrives at main via the existing `log:write` IPC call and
     `packages/electron/src/ipc/log.ts`): load the shipped Angular `.map` for that bundle
     file.
   - Cache parsed source-map consumers per file - don't reparse per log call.
   - Call the map's "original position" lookup on the compiled `{file, line, column}` to
     get back the real `{source, line}`, and store _that_ as `filename`/`line` instead of
     the compiled location.
   - Fall back to the raw compiled location if no map is found or resolution throws, so a
     log line is never lost over this.

4. **Verify against an actual packaged build**, not just unit tests - this needs the real
   build artifacts (with maps) laid out the way electron-builder actually ships them, the
   same "must build and check the real thing" category as the differential-update
   verification work done for issue #297's update flow.

## Why it was deferred

Scoped out of #303 deliberately: the low-effort version (structured `context` + a
compiled-location pointer) already turns an unreadable `[object Object]` log line into
something greppable, which was the immediate pain point. Whether the compiled location is
"good enough" in practice, or whether the TS-accurate resolution above is worth the added
build-pipeline and packaging risk, is easier to judge once the shipped version has actually
been used to chase a real bug.
