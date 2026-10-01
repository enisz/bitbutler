import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ManageServersGridSettingsService } from '../../services/manage-servers-grid.settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { ManageServers } from './manage-servers';

describe('ManageServers', () => {
  let component: ManageServers;
  let fixture: ComponentFixture<ManageServers>;
  let serverStoreService: {
    servers: ReturnType<typeof signal<any[]>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    select: ReturnType<typeof vi.fn>;
  };
  let manageServersGridSettingsService: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    serverStoreService = {
      servers: signal([]),
      currentServerId: signal(null),
      loading: signal(false),
      select: vi.fn(),
    };
    manageServersGridSettingsService = {
      load: vi.fn().mockResolvedValue({ columnState: [], filterModel: null }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ManageServers],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreService },
        { provide: ManageServersGridSettingsService, useValue: manageServersGridSettingsService },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TranslateService, useFactory: mockTranslateService },
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageServers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hideConnect', () => {
    it('should default to false', () => {
      expect(component.hideConnect()).toBe(false);
    });
  });

  describe('row selectability', () => {
    it('disables row selection for the active server', () => {
      serverStoreService.servers.set([
        {
          id: 'srv-1',
          name: 'Home',
          host: '1.2.3.4',
          protocol: 'http',
          port: 8080,
          username: '',
          auto_login: false,
        } as never,
        {
          id: 'srv-2',
          name: 'Away',
          host: '5.6.7.8',
          protocol: 'http',
          port: 8080,
          username: '',
          auto_login: false,
        } as never,
      ]);
      serverStoreService.currentServerId.set('srv-1');

      fixture.detectChanges();

      expect(component.isRowSelectable({ data: { id: 'srv-1' } } as never)).toBe(false);
      expect(component.isRowSelectable({ data: { id: 'srv-2' } } as never)).toBe(true);
    });
  });

  describe('enable flags', () => {
    it('computes canDelete as true only when at least one row is selected', () => {
      component.selectedServers.set([]);
      expect(component.canDelete()).toBe(false);

      component.selectedServers.set([{ id: 'srv-2' } as never]);
      expect(component.canDelete()).toBe(true);
    });

    it('computes canEdit and canConnect as true only when exactly one row is selected', () => {
      component.selectedServers.set([]);
      expect(component.canEdit()).toBe(false);
      expect(component.canConnect()).toBe(false);

      component.selectedServers.set([{ id: 'srv-2' } as never]);
      expect(component.canEdit()).toBe(true);
      expect(component.canConnect()).toBe(true);

      component.selectedServers.set([{ id: 'srv-2' } as never, { id: 'srv-3' } as never]);
      expect(component.canEdit()).toBe(false);
      expect(component.canConnect()).toBe(false);
    });

    it('computes canConnect as false when hideConnect is true, even with exactly one row selected', () => {
      fixture.componentRef.setInput('hideConnect', true);
      component.selectedServers.set([{ id: 'srv-2' } as never]);
      expect(component.canConnect()).toBe(false);
    });
  });

  describe('column state persistence', () => {
    it('flushes a pending debounced column-state save immediately on destroy', () => {
      const api = {
        getColumnState: () => [{ colId: 'name', hide: false }],
        getFilterModel: () => null,
      } as never;
      component.onGridReady({ api } as never);
      component.onColumnChanged(); // queues a debounced save; the 500ms timer has not fired yet

      component.ngOnDestroy();

      expect(manageServersGridSettingsService.save).toHaveBeenCalledWith({
        columnState: [{ colId: 'name', hide: false }],
        filterModel: null,
      });
    });

    it('does nothing on destroy when no column-state change is pending', () => {
      component.ngOnDestroy();
      expect(manageServersGridSettingsService.save).not.toHaveBeenCalled();
    });
  });
});
