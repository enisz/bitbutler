# Manage Servers credential prompt

## Problem

In the Manage Servers modal, clicking "connect" on a server with no saved
username/password (`!server.username || !server.has_password`) and no active
session calls `qbService.auth.login()` directly with no credentials. This
either fails outright or attempts login with nothing, always landing on the
generic "failed to connect" toast, with no way to enter credentials from this
modal.

The login page's `connect()` already handles this case correctly: it opens
`CredentialPrompt`, then either persists the entered credentials (if the user
opts in) or passes them through for a one-off login. `ManageServers.switchTo()`
should behave the same way.

## Scope

Only `packages/app/src/app/modals/manage-servers/manage-servers.ts` (and its
spec) changes. The `CredentialPrompt` component itself, and its "save
credentials" checkbox default (stays unchecked), are unchanged.

## Design

`switchTo(server)` current flow:

1. Guard on `busy()`, set `connectingId`.
2. `hasCookie(server.id)` → if false, call `login(server.id)` with no
   credentials; throw if `!loginRes.loggedIn`.
3. On success: `select(server.id)`, dismiss modal.
4. On any throw: danger toast with server name + generic failed-to-connect
   title.
5. `finally`: clear `connectingId`.

New flow — insert a credential-prompt step between 2 and 3, only reached when
there is no session **and** the server is missing credentials:

```
if (!hasSession) {
  let runtimeUsername: string | undefined;
  let runtimePassword: string | undefined;

  if (!server.username || !server.has_password) {
    lazy-load and open CredentialPrompt
      (setModalInput 'serverName' = server.name, 'prefillUsername' = server.username)
    try {
      result = await credModalRef.result   // { username, password, save }
      if (result.save && (result.username || result.password)) {
        await serverService.update(server.id, { username: result.username, password: result.password })
        commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id })
      } else {
        runtimeUsername = result.username
        runtimePassword = result.password
      }
    } catch {
      return   // user cancelled/dismissed - exit quietly, no toast
               // (still runs the outer `finally` that clears connectingId)
    }
  }

  loginRes = await login(server.id, runtimeUsername, runtimePassword)
  if (!loginRes.loggedIn) throw new Error('Login failed')
}
```

This exactly mirrors `login.ts`'s `connect()` (same condition, same
save-vs-runtime branching, same silent-cancel behavior). The existing
danger-toast catch block is untouched and only fires for an actual login
failure, not for a cancelled prompt.

`ServerService` becomes a new dependency of `ManageServers` (already used by
`login.ts` the same way).

No change to `CredentialPrompt` — the "save credentials" checkbox stays
unchecked by default, in both callers.

## Testing

Add to `manage-servers.spec.ts` (add a `ServerService` mock — `{ update:
vi.fn() }` — and an `NgbModal.open` mock returning a fake modal ref):

- No session + missing credentials → opens `CredentialPrompt` with the
  server's name/username, before calling `login`.
- No session + credentials already present → skips the prompt, calls `login`
  directly (existing behavior, already covered).
- Session already exists → skips the prompt entirely (existing behavior).
- Prompt resolves with `save: true` → calls `serverService.update` and emits
  `SERVER_UPDATED`, then logs in with no runtime args.
- Prompt resolves with `save: false` → logs in with the entered
  username/password, does not call `serverService.update`.
- Prompt dismissed/cancelled → `switchTo` returns without calling `login` and
  without a toast; `connectingId` is cleared.
- Existing "login fails → danger toast" test continues to pass unchanged.

## Out of scope

- The "save credentials" checkbox default (confirmed: stays unchecked).
- Any change to `CredentialPrompt` itself.

## Addendum: extracted to `CredentialPromptService`

The final whole-branch review found a third call site with the identical
missing-credentials bug: `UiCommandHandlerService.handleServerSwitch()` (the
app/tray menu's "switch server" action). The original two-call-site "duplicate
directly" decision above no longer holds at three call sites. The
implementation plan's Tasks 2-4 extract the shared check-and-prompt logic into
a new `CredentialPromptService` (`needsPrompt()` / `resolve()`), and
`login.ts`, `manage-servers.ts`, and `ui-command-handler.service.ts` all call
it instead of inlining the logic. See the plan for exact interfaces.
