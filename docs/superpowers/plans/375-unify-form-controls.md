# #375 - Unify form controls - implementation plan

Spec: `docs/superpowers/specs/375-unify-form-controls.md`. One review after all tasks.

## Foundation

1. **Tokens + shared styles** - `styles/_form-controls.scss`: `--bb-check-*` / `--bb-switch-*`
   tokens on `:root`, the shared control classes (box, circle, switch track, card, segment,
   focus ring, inline spacing), `.bb-option--stacked`. Wire into `styles.scss`.
2. **`BbCheckbox`** + spec.
3. **`BbSwitch`** + spec.
4. **`BbRadioGroup` / `BbRadio`** (list, inline, cards, `columns`) + spec.
5. **`BbInlineGroup`** + spec.
6. **`BbSegmented`** + spec.
7. **`BbCheckTree`** + spec.

## Migration

8. App settings pages: general (switches, save path cards, date format cards, first day of
   week inline), appearance (theme mode inline), notifications (switches, position cards 2x2),
   startup, torrent-list-grid (switches, row double-click cards).
9. qB settings pages: storage (content layout + TMM cards, change behaviors inline),
   seeding-ratios (ratio action cards), queue-limits, bandwidth.
10. Modals: add torrent (general segmented, options, folder picker), delete torrent (danger
    checkbox), server editor, credential prompt, torrent details general, import configuration
    (server check tree).
11. Export torrents (scope cards), import torrents (switches, after-import cards).
12. Transfer limit / share limit (segmented `sm`).
13. File tree (checkbox + mixed), set column filter (check tree), any remaining hits.
14. i18n: new sub-text keys in `us.json` + `hu.json`; drop keys no longer used.

## Cleanup + verification

15. Remove the per-theme check/switch overrides and marker maps from the 16 theme files, the
    dead `btn-group` / `segmented-picker` / `.bb-option__toggle` styles; acceptance grep is empty.
16. Update affected specs; `npm run lint`, `npm test`, `npm run build`; visual pass in the app
    (light + dark).
