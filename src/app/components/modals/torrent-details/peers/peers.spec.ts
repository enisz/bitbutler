import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../../../services/qb-polling.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
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
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal(null) } },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        {
          provide: QbPollingService,
          useValue: { startPeersPolling: vi.fn().mockReturnValue(new Subject()) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Peers);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading = true', () => {
    expect(component.loading).toBe(true);
  });

  it('should start with an empty peers list', () => {
    expect(component.peers).toHaveLength(0);
  });

  it('should have column definitions', () => {
    expect(component.colDefs.length).toBeGreaterThan(0);
  });

  it('should have grid options defined', () => {
    expect(component.gridOptions).toBeDefined();
  });
});
