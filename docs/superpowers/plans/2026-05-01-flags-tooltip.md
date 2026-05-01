# Flags Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an HTML-formatted AG Grid tooltip to the `flags` column in the peers grid that shows each active flag as a colored badge with a plain-English description.

**Architecture:** A new `FlagsTooltipComponent` implementing `ITooltipAngularComp` reads the space-separated `flags` string from peer data, looks each flag up in a static `PEER_FLAG_DEFINITIONS` constant, and renders a compact stacked-section layout. The flags column definition in `peers.ts` is updated to use this component with `tooltipShowMode: 'always'` to override the global `whenTruncated` setting.

**Tech Stack:** Angular 20 (zoneless, signal-free for this feature), AG Grid v35 (`ITooltipAngularComp`), Bootstrap CSS variables for theming.

---

## File Map

| Action | Path                                                                                   | Responsibility                 |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------ |
| Create | `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.const.ts` | Static flag definitions array  |
| Create | `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.ts`       | AG Grid tooltip component      |
| Create | `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.html`     | Stacked-section template       |
| Create | `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.scss`     | Tooltip shell + badge styles   |
| Create | `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.spec.ts`  | Component tests                |
| Modify | `src/app/components/modals/torrent-details/peers/peers.ts`                             | Wire tooltip into flags column |

---

### Task 1: Flag definitions constant

**Files:**

- Create: `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.const.ts`

- [ ] **Step 1: Create the constant file**

```typescript
export type PeerFlagColor = 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'secondary';

export interface PeerFlagDefinition {
  flag: string;
  label: string;
  description: string;
  color: PeerFlagColor;
}

export const PEER_FLAG_DEFINITIONS: PeerFlagDefinition[] = [
  {
    flag: 'D',
    label: 'Downloading',
    description: 'You are currently receiving data from this peer.',
    color: 'info',
  },
  {
    flag: 'U',
    label: 'Uploading',
    description: 'You are currently sending data to this peer.',
    color: 'success',
  },
  {
    flag: 'd',
    label: 'Interested (Down)',
    description: 'You want to download from them, but they are choking you (refusing to send).',
    color: 'info',
  },
  {
    flag: 'u',
    label: 'Interested (Up)',
    description: 'They want to download from you, but you are choking them.',
    color: 'success',
  },
  {
    flag: 'O',
    label: 'Optimistic Unchoke',
    description: 'You are testing this peer to see if they give you good speeds.',
    color: 'warning',
  },
  {
    flag: 'S',
    label: 'Snubbed',
    description: "The peer hasn't sent you data for a while, so you've stopped sending to them.",
    color: 'danger',
  },
  {
    flag: 'I',
    label: 'Incoming',
    description: 'The peer connected to you (useful for checking if your ports are open).',
    color: 'primary',
  },
  {
    flag: 'E',
    label: 'Encrypted',
    description: 'The connection is using protocol encryption.',
    color: 'warning',
  },
  {
    flag: 'H',
    label: 'DHT',
    description: 'Found via Distributed Hash Table (no tracker needed).',
    color: 'secondary',
  },
  {
    flag: 'X',
    label: 'PEX',
    description: 'Found via Peer Exchange (other peers told you about them).',
    color: 'secondary',
  },
  {
    flag: 'L',
    label: 'Local',
    description: 'Found via Local Peer Discovery (same Wi-Fi/LAN).',
    color: 'secondary',
  },
  {
    flag: 'P',
    label: 'uTP',
    description: 'The connection is using the Micro Transport Protocol (UDP-based).',
    color: 'secondary',
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.const.ts
git commit -m "#62: add peer flag definitions constant"
```

---

### Task 2: Tooltip component

**Files:**

- Create: `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.ts`
- Create: `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.html`
- Create: `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.scss`

- [ ] **Step 1: Create the component class**

`src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.ts`:

```typescript
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';
import { QbTorrentPeer } from '../../../../../models/torrent.model';
import { PEER_FLAG_DEFINITIONS, PeerFlagDefinition } from './flags-tooltip.const';

@Component({
  selector: 'app-flags-tooltip',
  imports: [CommonModule],
  templateUrl: './flags-tooltip.html',
  styleUrl: './flags-tooltip.scss',
})
export class FlagsTooltipComponent implements ITooltipAngularComp {
  public activeFlags: PeerFlagDefinition[] = [];

  public agInit(params: ITooltipParams<QbTorrentPeer>): void {
    const raw = params.data?.flags ?? '';
    const active = new Set(raw.split(' ').filter(Boolean));
    this.activeFlags = PEER_FLAG_DEFINITIONS.filter((d) => active.has(d.flag));
  }
}
```

- [ ] **Step 2: Create the template**

`src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.html`:

```html
<div class="flags-tooltip">
  <div class="flags-tooltip__title">Peer Flags</div>
  @for (flag of activeFlags; track flag.flag) {
  <div class="flags-tooltip__entry">
    <div class="flags-tooltip__header">
      <span class="flags-tooltip__badge flags-tooltip__badge--{{ flag.color }}"
        >{{ flag.flag }}</span
      >
      <span class="flags-tooltip__name">{{ flag.label }}</span>
    </div>
    <div class="flags-tooltip__desc">{{ flag.description }}</div>
  </div>
  }
</div>
```

- [ ] **Step 3: Create the styles**

`src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.scss`:

```scss
.flags-tooltip {
  padding: 7px 10px;
  min-width: 220px;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  &__title {
    font-size: 9px;
    color: color-mix(in srgb, var(--bs-body-color) 50%, transparent);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 600;
    margin-bottom: 5px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--bs-border-color);
  }

  &__entry {
    & + & {
      border-top: 1px solid var(--bs-border-color);
      margin-top: 5px;
      padding-top: 5px;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }

  &__badge {
    border-radius: 3px;
    padding: 0 5px;
    font-weight: 700;
    font-size: 11px;
    font-family: monospace;
    flex-shrink: 0;
    line-height: 1.6;

    &--info {
      background: var(--bs-info);
      color: var(--bb-info-ink);
    }
    &--success {
      background: var(--bs-success);
      color: var(--bb-success-ink);
    }
    &--warning {
      background: var(--bs-warning);
      color: var(--bb-warning-ink);
    }
    &--danger {
      background: var(--bs-danger);
      color: var(--bb-danger-ink);
    }
    &--primary {
      background: var(--bs-primary);
      color: var(--bb-primary-ink);
    }
    &--secondary {
      background: var(--bs-secondary);
      color: var(--bb-secondary-ink);
    }
  }

  &__name {
    font-size: 12px;
    font-weight: 600;
    color: var(--bs-body-color);
  }

  &__desc {
    font-size: 11px;
    color: color-mix(in srgb, var(--bs-body-color) 50%, transparent);
    padding-left: 27px;
    line-height: 1.4;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/modals/torrent-details/peers/flags-tooltip/
git commit -m "#62: add FlagsTooltipComponent"
```

---

### Task 3: Tests

**Files:**

- Create: `src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.spec.ts`

- [ ] **Step 1: Write the failing tests**

`src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagsTooltipComponent } from './flags-tooltip';

describe('FlagsTooltipComponent', () => {
  let component: FlagsTooltipComponent;
  let fixture: ComponentFixture<FlagsTooltipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlagsTooltipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagsTooltipComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.agInit({ data: { flags: 'U I' } } as any);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should resolve known flags from the flags string', () => {
    component.agInit({ data: { flags: 'U I' } } as any);
    expect(component.activeFlags.length).toBe(2);
    expect(component.activeFlags[0].flag).toBe('U');
    expect(component.activeFlags[1].flag).toBe('I');
  });

  it('should preserve the order defined in PEER_FLAG_DEFINITIONS', () => {
    // D comes before U in the definitions
    component.agInit({ data: { flags: 'U D' } } as any);
    expect(component.activeFlags[0].flag).toBe('D');
    expect(component.activeFlags[1].flag).toBe('U');
  });

  it('should silently ignore unknown flags', () => {
    component.agInit({ data: { flags: 'U Z' } } as any);
    expect(component.activeFlags.length).toBe(1);
    expect(component.activeFlags[0].flag).toBe('U');
  });

  it('should produce an empty list when flags is an empty string', () => {
    component.agInit({ data: { flags: '' } } as any);
    expect(component.activeFlags.length).toBe(0);
  });

  it('should produce an empty list when data is undefined', () => {
    component.agInit({ data: undefined } as any);
    expect(component.activeFlags.length).toBe(0);
  });

  it('should handle all 12 known flags', () => {
    component.agInit({ data: { flags: 'D U d u O S I E H X L P' } } as any);
    expect(component.activeFlags.length).toBe(12);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --include="**/flags-tooltip.spec.ts"
```

Expected: compile error or test failures because `FlagsTooltipComponent` exists but `agInit` logic may not match yet. Confirm tests are being picked up.

- [ ] **Step 3: Run tests to verify they pass**

After Task 2 is complete the implementation already exists. Run again:

```bash
npm test -- --include="**/flags-tooltip.spec.ts"
```

Expected: all 7 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/modals/torrent-details/peers/flags-tooltip/flags-tooltip.spec.ts
git commit -m "#62: add FlagsTooltipComponent tests"
```

---

### Task 4: Wire tooltip into the peers grid

**Files:**

- Modify: `src/app/components/modals/torrent-details/peers/peers.ts`

- [ ] **Step 1: Add the import**

In `peers.ts`, add this import alongside the existing `FlagCellRenderer` import (line ~34):

```typescript
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';
```

- [ ] **Step 2: Update the flags column definition**

Find the `flags` column definition (around line 356) and replace it:

```typescript
// Before
{
  colId: 'flags',
  field: 'flags',
  width: 100,
  headerName: this.translateService.instant(
    'components.modals.torrent-details.peers.col-def.flags',
  ),
  headerTooltip: this.translateService.instant(
    'components.modals.torrent-details.peers.col-def.flags',
  ),
  tooltipField: 'flags',
  filter: 'agTextColumnFilter',
},

// After
{
  colId: 'flags',
  field: 'flags',
  width: 100,
  headerName: this.translateService.instant(
    'components.modals.torrent-details.peers.col-def.flags',
  ),
  headerTooltip: this.translateService.instant(
    'components.modals.torrent-details.peers.col-def.flags',
  ),
  tooltipComponent: FlagsTooltipComponent,
  tooltipShowMode: 'always',
  filter: 'agTextColumnFilter',
},
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors or warnings (zero warnings allowed per project config).

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/modals/torrent-details/peers/peers.ts
git commit -m "#62: wire FlagsTooltipComponent into peers grid flags column"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start the app**

```bash
npm start
```

Wait for Angular dev server and Electron window to open.

- [ ] **Step 2: Navigate to a torrent's peers tab**

Open any torrent → Details → Peers tab. Ensure there are peers connected.

- [ ] **Step 3: Verify tooltip appears on hover**

Hover over the `Flags` cell of any peer row. Confirm:

- Tooltip appears even when the flags text is not truncated
- Each flag shows as a colored badge (e.g. `U` in green, `I` in primary color)
- The flag name and description are displayed below the badge
- Sections are separated by a subtle divider

- [ ] **Step 4: Verify theme adaptation**

Open Settings → change theme (e.g. to Ocean Breeze or Crimson Ember). Return to the peers tab and hover a flags cell. Confirm badge colors adapt to the new theme.

- [ ] **Step 5: Verify unknown/empty flags gracefully**

If you can find a peer with an empty flags string, hover it — the tooltip should not appear (AG Grid suppresses empty tooltips) or appear with no entries. No console errors should occur.
