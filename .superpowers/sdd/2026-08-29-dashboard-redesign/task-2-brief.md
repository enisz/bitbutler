### Task 2: Fix widget-row height + scrollbar-inside-border on `torrent-list-widget`

Fixes two bugs together since they're both in the same file and the same root cause (the table owns both height and its own border/radius): rows currently stretch/shrink to fill whatever height gridstack gives the widget instead of keeping a fixed row height, and the table's native scrollbar renders flush against (and visually outside) the card's rounded border because the border and the scrolling element are the same box.

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new (visual/structural only) - `TorrentListWidget`'s public shape (`data`, `formattedValue`) is unchanged.

- [ ] **Step 1: Update the failing structural test**

The existing test queries `td` directly on the fixture root, which still works after the wrapper is added (querying isn't scoped to a specific ancestor), so no test changes are strictly required for correctness - but add one assertion that pins the new wrapper structure so a future edit can't silently reintroduce `height: 100%` on the table:

In `torrent-list-widget.spec.ts`, add to the existing `it('should render one row per data.rows entry ...')` test body:

```ts
const scrollHost = fixture.nativeElement.querySelector('.torrent-list-widget__scroll');
expect(scrollHost).toBeTruthy();
expect(fixture.nativeElement.querySelector('table').classList).toContain(
  'torrent-list-widget__table',
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- torrent-list-widget`
Expected: FAIL - `.torrent-list-widget__scroll` not found (current markup has no wrapper).

- [ ] **Step 3: Restructure the template**

Replace the full contents of `torrent-list-widget.html` with:

```html
<div class="torrent-list-widget">
  <div class="torrent-list-widget__scroll">
    <table class="torrent-list-widget__table">
      <thead>
        <tr>
          @for (column of data.columns; track column) {
          <th>{{ 'pages.dashboard.widgets.torrent-list.column.' + column | translate }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of data.rows; track row.hash) {
        <tr>
          @for (column of data.columns; track column) {
          <td>{{ formattedValue(row, column) }}</td>
          }
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 4: Restructure the styles**

Replace the full contents of `torrent-list-widget.scss` with:

```scss
// See stat-tile.scss for why :host needs an explicit display/size: GridStack inserts
// <app-torrent-list-widget> as a bare custom element, which renders inline by default and gives
// height:100% below nothing definite to resolve against.
:host {
  display: block;
  height: 100%;
  width: 100%;
}

.torrent-list-widget {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--bs-card-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  // Clips the scroll layer's content to the card's rounded corners - without this, a table tall
  // enough to scroll paints square corners over the border-radius.
  overflow: hidden;

  &__scroll {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    // Right-side gutter so the scrollbar has space of its own instead of sitting flush against
    // (and, with a rounded border, visually poking outside of) the card edge.
    padding-right: 0.375rem;
  }

  &__table {
    width: 100%;
    // No height rule here - rows keep their intrinsic padding/font-size height. Below that
    // height the __scroll wrapper scrolls; above it, the table just leaves blank space beneath
    // itself instead of the browser stretching rows to fill the container.
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    padding: 0.25rem 0.5rem;
    text-align: left;
    white-space: nowrap;
  }

  th {
    text-transform: uppercase;
    font-size: 0.7rem;
    opacity: 0.7;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-list-widget`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts
git commit -m "#324: fix fixed-height rows and scrollbar gutter on torrent-list-widget"
```

---

