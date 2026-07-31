import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { StatusBarSettings } from '../../../models/status-bar-settings.model';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';
import { SettingsStateService } from '../settings-state.service';
import { StatusBar } from './status-bar';

describe('StatusBar', () => {
  let component: StatusBar;
  let fixture: ComponentFixture<StatusBar>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let statusBarSettings$: Subject<StatusBarSettings>;

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    statusBarSettings$ = new Subject<StatusBarSettings>();

    await TestBed.configureTestingModule({
      imports: [StatusBar],
      providers: [
        { provide: SettingsStateService, useValue: stateServiceMock },
        {
          provide: StatusBarSettingsService,
          useValue: { asObservable: () => statusBarSettings$.asObservable() },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('drop', () => {
    it('should reorder items when dragged within the same container', () => {
      component.left = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const container = { data: component.left } as any;
      component.drop({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 2,
      } as any);
      expect(component.left[0].id).toBe('b');
      expect(component.left[1].id).toBe('c');
      expect(component.left[2].id).toBe('a');
    });

    it('should transfer an item between containers', () => {
      component.left = [{ id: 'a', label: 'A' }];
      component.right = [{ id: 'b', label: 'B' }];
      component.drop({
        previousContainer: { data: component.left } as any,
        container: { data: component.right } as any,
        previousIndex: 0,
        currentIndex: 0,
      } as any);
      expect(component.right[0].id).toBe('a');
      expect(component.left).toHaveLength(0);
    });

    it('should mark status-bar as dirty after any drop', () => {
      component.left = [{ id: 'a', label: 'A' }];
      const container = { data: component.left } as any;
      component.drop({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 0,
      } as any);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('status-bar', true);
    });
  });

  describe('settings reconciliation', () => {
    it('should append a known widget id missing from the stored settings into available', () => {
      statusBarSettings$.next({
        available: ['selection', 'alltime-down', 'alltime-up'],
        left: ['connection-status', 'nodes', 'ratio', 'global-down', 'global-up'],
        right: ['download-speed', 'upload-speed', 'free-space', 'polling-indicator'],
      });
      fixture.detectChanges();

      expect(component.available.some((w) => w.id === 'alltime-ratio')).toBe(true);
    });

    it('should not duplicate a widget already placed in left or right', () => {
      statusBarSettings$.next({
        available: ['selection'],
        left: ['connection-status', 'nodes', 'ratio', 'global-down', 'global-up', 'alltime-ratio'],
        right: ['download-speed', 'upload-speed', 'free-space', 'polling-indicator'],
      });
      fixture.detectChanges();

      expect(component.available.filter((w) => w.id === 'alltime-ratio')).toHaveLength(0);
      expect(component.left.some((w) => w.id === 'alltime-ratio')).toBe(true);
    });
  });
});
