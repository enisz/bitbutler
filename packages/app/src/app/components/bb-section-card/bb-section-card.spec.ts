import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BbSectionCard } from './bb-section-card';

@Component({
  template: `
    <app-bb-section-card title="Language">
      <span bbCardTitleExtra class="extra">?</span>
      <span bbCardAction class="action">Interface</span>
      <p class="body-content">Body</p>
    </app-bb-section-card>
    <app-bb-section-card title="Plain"><p>Only a body</p></app-bb-section-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbSectionCard],
})
class HostComponent {}

describe('BbSectionCard', () => {
  let root: HTMLElement;
  let cards: HTMLElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
    cards = fixture.debugElement
      .queryAll(By.directive(BbSectionCard))
      .map((debugElement) => debugElement.nativeElement);
  });

  it('renders the title in the header', () => {
    expect(
      cards[0].querySelector('.bb-section-card__header .bb-section-card__title')?.textContent,
    ).toBe('Language');
  });

  it('projects the body into the body area', () => {
    expect(cards[0].querySelector('.bb-section-card__body .body-content')?.textContent).toBe(
      'Body',
    );
  });

  it('projects the title extra next to the title and the action into the action slot', () => {
    expect(cards[0].querySelector('.bb-section-card__header > .extra')).not.toBeNull();
    expect(cards[0].querySelector('.bb-section-card__action .action')?.textContent).toBe(
      'Interface',
    );
  });

  it('leaves the action slot empty when no action is projected', () => {
    expect(cards[1].querySelector('.bb-section-card__action')?.children).toHaveLength(0);
  });

  it('is a group labelled by its title', () => {
    const title = cards[0].querySelector('.bb-section-card__title') as HTMLElement;

    expect(cards[0].getAttribute('role')).toBe('group');
    expect(cards[0].getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('gives every card a unique title id', () => {
    const ids = cards.map((card) => card.getAttribute('aria-labelledby'));

    expect(new Set(ids).size).toBe(ids.length);
    expect(root.querySelectorAll('[id^="bb-section-card-title-"]')).toHaveLength(2);
  });
});
