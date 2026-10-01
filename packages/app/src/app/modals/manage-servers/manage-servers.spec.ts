import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { CredentialPromptService } from '../../services/credential-prompt.service';
import { ManageServersGridSettingsService } from '../../services/manage-servers-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
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
  let activeModal: { dismiss: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let modalService: { open: ReturnType<typeof vi.fn> };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let confirmService: { confirm: ReturnType<typeof vi.fn> };
  let serverService: { update: ReturnType<typeof vi.fn> };
  let qbService: {
    auth: { hasCookie: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
  };
  let credentialPromptService: {
    needsPrompt: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
  };
  let toastService: { danger: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let contextMenuService: { open: ReturnType<typeof vi.fn> };
  let gridContextMenuService: { buildHeaderMenu: ReturnType<typeof vi.fn> };

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
    activeModal = { dismiss: vi.fn(), close: vi.fn() };
    modalService = { open: vi.fn() };
    commandBusService = { emit: vi.fn() };
    confirmService = { confirm: vi.fn().mockResolvedValue(true) };
    serverService = { update: vi.fn().mockResolvedValue(true) };
    qbService = {
      auth: {
        hasCookie: vi.fn().mockResolvedValue(true),
        login: vi.fn().mockResolvedValue({ loggedIn: true }),
      },
    };
    credentialPromptService = {
      needsPrompt: vi.fn().mockReturnValue(false),
      resolve: vi.fn().mockResolvedValue({}),
    };
    toastService = { danger: vi.fn(), success: vi.fn() };
    contextMenuService = { open: vi.fn() };
    gridContextMenuService = { buildHeaderMenu: vi.fn().mockReturnValue([]) };

    await TestBed.configureTestingModule({
      imports: [ManageServers],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreService },
        { provide: ManageServersGridSettingsService, useValue: manageServersGridSettingsService },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TranslateService, useFactory: mockTranslateService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NgbModal, useValue: modalService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: ConfirmService, useValue: confirmService },
        { provide: ServerService, useValue: serverService },
        { provide: QbService, useValue: qbService },
        { provide: CredentialPromptService, useValue: credentialPromptService },
        { provide: ToastService, useValue: toastService },
        { provide: ContextMenuService, useValue: contextMenuService },
        { provide: GridContextMenuService, useValue: gridContextMenuService },
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

  describe('actions', () => {
    it('emits SERVER_ADDED after creating a new server via ServerEditor', async () => {
      modalService.open.mockReturnValue({ result: Promise.resolve('new-id') } as never);

      await component.openNew();

      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_ADDED', id: 'new-id' });
    });

    it('does not emit SERVER_ADDED when ServerEditor is dismissed', async () => {
      modalService.open.mockReturnValue({ result: Promise.reject('dismissed') } as never);

      await component.openNew();

      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('deletes all selected servers after confirmation, one SERVER_DELETED per id', async () => {
      confirmService.confirm.mockResolvedValue(true);
      component.selectedServers.set([{ id: 'srv-2' } as never, { id: 'srv-3' } as never]);

      await component.deleteSelected();

      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-2' });
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-3' });
    });

    it('does not delete when confirmation is declined', async () => {
      confirmService.confirm.mockResolvedValue(false);
      component.selectedServers.set([{ id: 'srv-2' } as never]);

      await component.deleteSelected();

      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('connects without closing the modal', async () => {
      component.selectedServers.set([{ id: 'srv-2', name: 'Away' } as never]);

      await component.connectSelected();

      expect(activeModal.close).not.toHaveBeenCalled();
      expect(serverStoreService.select).toHaveBeenCalledWith('srv-2');
    });

    it("toggles a server's auto_login flag and emits SERVER_UPDATED", async () => {
      serverService.update.mockResolvedValue(undefined);
      const server = { id: 'srv-2', auto_login: false } as never;

      await component.toggleDefault(server);

      expect(serverService.update).toHaveBeenCalledWith('srv-2', { auto_login: true });
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-2' });
    });

    it('disables Connect when hideConnect is true, even with exactly one row selected (Review: login-page usage must not imply a live connection switch)', () => {
      fixture.componentRef.setInput('hideConnect', true);
      component.selectedServers.set([{ id: 'srv-2' } as never]);

      expect(component.canConnect()).toBe(false);
    });

    it('omits Connect and Set as Default from the row context menu when hideConnect is true', () => {
      fixture.componentRef.setInput('hideConnect', true);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({ data: { id: 'srv-2' } } as never);

      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string }[] },
      ];
      expect(items.some((i) => i.label === 'general.button.connect')).toBe(false);
      expect(
        items.some((i) => i.label === 'components.modals.manage-servers.tooltip.set-as-default'),
      ).toBe(false);
    });

    it('excludes Delete from the row context menu for the active server, regardless of hideConnect', () => {
      serverStoreService.currentServerId.set('srv-2');
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({ data: { id: 'srv-2' } } as never);

      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string }[] },
      ];
      expect(items.some((i) => i.label === 'general.button.delete')).toBe(false);
    });
  });
});
