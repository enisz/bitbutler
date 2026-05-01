# Design: Flags Tooltip for Peers Grid

**Date:** 2026-05-01
**Issue:** #62 (grid state tracker peer)

## Overview

Add an HTML-formatted AG Grid tooltip to the `flags` column in the peers grid. The tooltip always appears on hover (even when text is not truncated) and shows each flag as a stacked section with a colored badge and a plain-English description.

## Visual Design

Each flag in the space-separated `flags` string gets its own section:

```
┌─────────────────────────────────────────┐
│ PEER FLAGS                              │  ← muted uppercase label
├─────────────────────────────────────────┤
│ [U] Uploading                           │  ← colored badge + bold name
│     You are currently sending data...   │  ← muted description, indented
├─────────────────────────────────────────┤
│ [I] Incoming                            │
│     The peer connected to you...        │
└─────────────────────────────────────────┘
```

Tooltip is compact: `7px 10px` padding, `11px` description text, `5px` gap between sections.

## Flag Definitions

All 12 flags, their labels, descriptions, and color group:

| Flag | Label              | Description                                                                   | Color       |
| ---- | ------------------ | ----------------------------------------------------------------------------- | ----------- |
| `D`  | Downloading        | You are currently receiving data from this peer.                              | `info`      |
| `U`  | Uploading          | You are currently sending data to this peer.                                  | `success`   |
| `d`  | Interested (Down)  | You want to download from them, but they are choking you (refusing to send).  | `info`      |
| `u`  | Interested (Up)    | They want to download from you, but you are choking them.                     | `success`   |
| `O`  | Optimistic Unchoke | You are testing this peer to see if they give you good speeds.                | `warning`   |
| `S`  | Snubbed            | The peer hasn't sent you data for a while, so you've stopped sending to them. | `danger`    |
| `I`  | Incoming           | The peer connected to you (useful for checking if your ports are open).       | `primary`   |
| `E`  | Encrypted          | The connection is using protocol encryption.                                  | `warning`   |
| `H`  | DHT                | Found via Distributed Hash Table (no tracker needed).                         | `secondary` |
| `X`  | PEX                | Found via Peer Exchange (other peers told you about them).                    | `secondary` |
| `L`  | Local              | Found via Local Peer Discovery (same Wi-Fi/LAN).                              | `secondary` |
| `P`  | uTP                | The connection is using the Micro Transport Protocol (UDP-based).             | `secondary` |

## Color System

Badge backgrounds use Bootstrap CSS variables — fully theme-aware, no hardcoded colors:

| Color group | Background var   | Text var             |
| ----------- | ---------------- | -------------------- |
| `info`      | `--bs-info`      | `--bb-info-ink`      |
| `success`   | `--bs-success`   | `--bb-success-ink`   |
| `warning`   | `--bs-warning`   | `--bb-warning-ink`   |
| `danger`    | `--bs-danger`    | `--bb-danger-ink`    |
| `primary`   | `--bs-primary`   | `--bb-primary-ink`   |
| `secondary` | `--bs-secondary` | `--bb-secondary-ink` |

Tooltip shell uses `--bs-card-cap-bg` (background), `--bs-border-color` (border), `--bs-body-color` (flag name), and a muted variant of `--bs-body-color` at 50% opacity (description text).

## New Files

```
src/app/components/modals/torrent-details/peers/flags-tooltip/
  flags-tooltip.ts        — ITooltipAngularComp component
  flags-tooltip.html      — stacked-section template
  flags-tooltip.scss      — tooltip shell + badge styles
  flags-tooltip.const.ts  — PEER_FLAG_DEFINITIONS constant array
```

## Modified Files

### `peers.ts`

Replace the `flags` column definition's `tooltipField` with `tooltipComponent` and add `tooltipShowMode`:

```ts
// Before
{
  colId: 'flags',
  field: 'flags',
  width: 100,
  headerName: ...,
  headerTooltip: ...,
  tooltipField: 'flags',
  filter: 'agTextColumnFilter',
}

// After
{
  colId: 'flags',
  field: 'flags',
  width: 100,
  headerName: ...,
  headerTooltip: ...,
  tooltipComponent: FlagsTooltipComponent,
  tooltipShowMode: 'always',
  filter: 'agTextColumnFilter',
}
```

## Component Design

### `flags-tooltip.const.ts`

```ts
export interface PeerFlagDefinition {
  flag: string;
  label: string;
  description: string;
  color: 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'secondary';
}

export const PEER_FLAG_DEFINITIONS: PeerFlagDefinition[] = [
  { flag: 'D', label: 'Downloading', description: '...', color: 'info' },
  // ... all 12
];
```

### `flags-tooltip.ts`

```ts
@Component({ ... })
export class FlagsTooltipComponent implements ITooltipAngularComp {
  params!: ITooltipParams<QbTorrentPeer>;
  flags: PeerFlagDefinition[] = [];

  agInit(params: ITooltipParams<QbTorrentPeer>): void {
    this.params = params;
    const raw = params.data?.flags ?? '';
    const active = new Set(raw.split(' ').filter(Boolean));
    this.flags = PEER_FLAG_DEFINITIONS.filter(d => active.has(d.flag));
  }
}
```

The template iterates `flags` and renders the badge + stacked section layout. Unknown flags (not in the constant) are simply absent from the tooltip. If `flags` is empty or absent, the tooltip renders with no entries (AG Grid won't show an empty tooltip anyway since the cell value drives show logic).

## Behavior Notes

- `tooltipShowMode: 'always'` is set on the column level, overriding the global `whenTruncated` from `GRID_SHARED_OPTIONS`
- The global `tooltipShowDelay: 500` and `tooltipMouseTrack: true` still apply
- The cell itself continues to show the raw `flags` string (e.g. `"U I"`) — no cell renderer change needed
- `enableBrowserTooltips: false` remains; this uses AG Grid's custom tooltip infrastructure
