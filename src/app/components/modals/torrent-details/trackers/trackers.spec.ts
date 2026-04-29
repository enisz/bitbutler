import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { Trackers } from './trackers';

describe('Trackers', () => {
  let component: Trackers;
  let fixture: ComponentFixture<Trackers>;

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
      imports: [Trackers],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: QbService, useValue: { torrentTrackers: vi.fn().mockResolvedValue([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Trackers);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading = true', () => {
    expect(component.loading).toBe(true);
  });

  it('should start with an empty trackers list', () => {
    expect(component.trackers).toHaveLength(0);
  });

  it('should have column definitions', () => {
    expect(component.colDefs.length).toBeGreaterThan(0);
  });
});
