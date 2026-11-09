import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PHONE_SORT_KEYS, PhoneSortKey } from '../../../models/mobile-list-settings.model';
import { PhoneListStateService } from '../../main/phone/phone-list-state.service';
import { MobileList } from './mobile-list';

describe('MobileList', () => {
  let fixture: ComponentFixture<MobileList>;
  let sortKey: ReturnType<typeof signal<PhoneSortKey>>;
  let sortDesc: ReturnType<typeof signal<boolean>>;
  let compact: ReturnType<typeof signal<boolean>>;
  let setSort: ReturnType<typeof vi.fn>;
  let setCompact: ReturnType<typeof vi.fn>;

  const el = (): HTMLElement => fixture.nativeElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('[data-sort-key]'));

  beforeEach(async () => {
    sortKey = signal<PhoneSortKey>('added_on');
    sortDesc = signal(true);
    compact = signal(false);
    // Mirrors PhoneListStateService.setSort: same key flips, another key starts name asc, others desc.
    setSort = vi.fn(async (key: PhoneSortKey) => {
      if (key === sortKey()) sortDesc.set(!sortDesc());
      else {
        sortKey.set(key);
        sortDesc.set(key !== 'name');
      }
    });
    setCompact = vi.fn(async (value: boolean) => compact.set(value));

    await TestBed.configureTestingModule({
      imports: [MobileList],
      providers: [
        {
          provide: PhoneListStateService,
          useValue: { sortKey, sortDesc, compact, setSort, setCompact },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileList);
    fixture.detectChanges();
  });

  it('shows the eight sort keys in order', () => {
    expect(rows().map((r) => r.dataset['sortKey'])).toEqual([...PHONE_SORT_KEYS]);
    expect(rows()).toHaveLength(8);
  });

  it('the active key shows the direction caret and others do not', () => {
    const carets = rows().map((r) => r.querySelector('.mobile-list__caret'));
    expect(carets.filter((c) => c !== null)).toHaveLength(1);
    expect(rows()[0].querySelector('.mobile-list__caret')).not.toBeNull();
    expect(rows()[0].dataset['direction']).toBe('desc');
  });

  it('tapping the active key flips the caret direction', async () => {
    rows()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setSort).toHaveBeenCalledWith('added_on');
    expect(rows()[0].dataset['direction']).toBe('asc');
  });

  it('tapping another key moves the caret and starts name ascending, others descending', async () => {
    rows()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setSort).toHaveBeenCalledWith('name');
    expect(rows()[0].querySelector('.mobile-list__caret')).toBeNull();
    expect(rows()[1].querySelector('.mobile-list__caret')).not.toBeNull();
    expect(rows()[1].dataset['direction']).toBe('asc');

    rows()[2].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()[2].dataset['direction']).toBe('desc');
  });

  it('the compact switch reflects and updates mobile compact only', async () => {
    const input = el().querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(input.checked).toBe(false);

    input.checked = true;
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setCompact).toHaveBeenCalledWith(true);
    expect(setSort).not.toHaveBeenCalled();
    expect(input.checked).toBe(true);
  });
});
