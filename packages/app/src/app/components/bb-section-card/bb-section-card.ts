import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * A titled group of related controls: header band with the title, then the body.
 *
 * Content projection slots:
 * - default: the body
 * - `[bbCardTitleExtra]`: inline next to the title, e.g. a help popover
 * - `[bbCardAction]`: right side of the header, e.g. a tag or a button
 *
 * Styling hooks, set on the host: `--bb-section-card-border` and `--bb-section-card-title`.
 */
@Component({
  selector: 'app-bb-section-card',
  templateUrl: './bb-section-card.html',
  styleUrl: './bb-section-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'titleId',
  },
})
export class BbSectionCard {
  public readonly title = input.required<string>();

  protected readonly titleId = `bb-section-card-title-${nextId++}`;
}
