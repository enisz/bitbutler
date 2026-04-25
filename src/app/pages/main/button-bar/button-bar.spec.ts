import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonBar } from './button-bar';

describe('ButtonBar', () => {
  let component: ButtonBar;
  let fixture: ComponentFixture<ButtonBar>;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonBar],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
