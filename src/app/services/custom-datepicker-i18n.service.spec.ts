import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { CustomDatepickerI18n } from './custom-datepicker-i18n.service';

describe('CustomDatepickerI18n', () => {
  let service: CustomDatepickerI18n;
  let translateInstant: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    translateInstant = vi.fn((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        CustomDatepickerI18n,
        { provide: TranslateService, useValue: { instant: translateInstant } },
      ],
    });

    service = TestBed.inject(CustomDatepickerI18n);
  });

  it('should get weekday label via translate service', () => {
    service.getWeekdayLabel(1);
    expect(translateInstant).toHaveBeenCalledWith('general.calendar.weekdays.1');
  });

  it('should get short month name via translate service', () => {
    service.getMonthShortName(3);
    expect(translateInstant).toHaveBeenCalledWith('general.calendar.months.short.3');
  });

  it('should get full month name via translate service', () => {
    service.getMonthFullName(12);
    expect(translateInstant).toHaveBeenCalledWith('general.calendar.months.full.12');
  });

  it('should format day aria label as day-month-year', () => {
    const label = service.getDayAriaLabel({ day: 15, month: 6, year: 2024 });
    expect(label).toBe('15-6-2024');
  });
});
