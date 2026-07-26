# SavePathSelect dropdown position input

## Problem

`SavePathSelect` is a split component: depending on the `inputType` input (`SavePathInputType`), it renders either an `ng-select` (`select` mode) or a raw input with `ngbTypeahead` (`typeahead` mode). Both underlying libraries support controlling which side of the input their dropdown/popup opens on, but through different input names and value sets:

- `ng-select`: `[dropdownPosition]`, type `'top' | 'right' | 'bottom' | 'left' | 'auto'` (default `'auto'`).
- `ngb-typeahead`: `[placement]`, type `PlacementArray` (a much larger set including `'top-start'`, `'end-bottom'`, etc.; default `['bottom-start', 'bottom-end', 'top-start', 'top-end']`).

Consumers of `SavePathSelect` currently cannot control dropdown positioning at all - callers have no way to request the dropdown open upward, for example, when the component sits near the bottom of a modal.

## Goal

Add a single input, `position`, that a consumer can set once regardless of which underlying component (`ng-select` or `ngb-typeahead`) is active, restricted to the four cardinal directions both libraries support natively with the same literal strings: `'top' | 'left' | 'bottom' | 'right'`.

## Design

### Input

```ts
export type SavePathSelectPosition = 'top' | 'left' | 'bottom' | 'right';

readonly position = input<SavePathSelectPosition | null>(null);
```

Default `null` (unset) means "let the library decide" - i.e. behave exactly as today, before this input existed.

### Resolving to each library's own default

`null` cannot simply be passed through as `undefined` to the underlying inputs. `ng-select`'s `dropdownPosition` is a signal input defaulting to `'auto'`, so passing `undefined` would work there - but `ngb-typeahead`'s `placement` is a plain `@Input()` whose default is assigned in its constructor (`['bottom-start', 'bottom-end', 'top-start', 'top-end']`); Angular's property binding re-invokes the setter every change-detection cycle regardless of value, so binding `undefined` would overwrite that array and break the built-in flip behavior.

To keep "unset" behaving identically to today for both components, two computed signals resolve `position()` explicitly to each library's own real default when unset:

```ts
public readonly resolvedDropdownPosition = computed<DropdownPosition>(
  () => this.position() ?? 'auto',
);

public readonly resolvedPlacement = computed<PlacementArray>(
  () => this.position() ?? ['bottom-start', 'bottom-end', 'top-start', 'top-end'],
);
```

When `position()` is one of the four directions, the same literal string is passed straight through to both - no translation needed, since both libraries accept `'top' | 'left' | 'bottom' | 'right'` literally.

### Template changes

- `ng-select`: bind `[dropdownPosition]="resolvedDropdownPosition()"`.
- `ngbTypeahead` input: bind `[placement]="resolvedPlacement()"`.

### Scope / non-goals

- No existing call site (`general.html` in add-torrent, `set-path.html`, `manage-categories.html` x2, `server.html`) will pass `position` - this change is purely additive, zero behavior change for current screens.
- `'auto'` is not exposed as a directly-selectable value of the new input; "unset" already means "let the library decide," matching the user's request.
- No new call site is updated to actually use non-default positioning as part of this change; that's left to whichever future caller needs it.

## Testing

Extend `save-path-select.spec.ts` to cover:

- Default (`position` unset): `ng-select` receives `dropdownPosition="auto"`, and the typeahead input receives the default placement array.
- `position` set to each of `'top' | 'left' | 'bottom' | 'right'`: both the `select` and `typeahead` render paths pass that literal value through to the underlying component's respective input.
