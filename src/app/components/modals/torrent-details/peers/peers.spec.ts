import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Peers } from './peers';

describe('Peers', () => {
  let component: Peers;
  let fixture: ComponentFixture<Peers>;

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
      imports: [Peers],
    }).compileComponents();

    fixture = TestBed.createComponent(Peers);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
