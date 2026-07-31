import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, of } from 'rxjs';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { Torrent } from '../../models/torrent.model';
import { CommandBusService } from '../../services/command-bus.service';
import { FilterService } from '../../services/filter.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { SelectionStoreService } from '../../services/selection-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { TorrentExists } from './torrent-exists';

describe('TorrentExists', () => {
  let component: TorrentExists;
  let fixture: ComponentFixture<TorrentExists>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockTorrentStore: Partial<TorrentStoreService>;
  let mockToastService: Partial<ToastService>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockTorrentStore = {
      torrentsMap: signal(new Map()) as any,
    };
    mockToastService = { success: vi.fn(), danger: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TorrentExists],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: TorrentStoreService, useValue: mockTorrentStore },
        { provide: SelectionStoreService, useValue: { setByHashes: vi.fn() } },
        { provide: FilterService, useValue: { filtered: signal([{ hash: 'abc123' } as Torrent]) } },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            asObservable: vi.fn().mockReturnValue(
              of({
                ...DEFAULT_GENERAL_SETTINGS,
                behavior: { ...DEFAULT_GENERAL_SETTINGS.behavior, deleteTorrentFile: true },
              }),
            ),
          },
        },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentExists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose hash as a signal input', () => {
    fixture.componentRef.setInput('hash', 'abc123');
    expect(component.hash()).toBe('abc123');
  });

  it('should return undefined torrent when hash is null', () => {
    fixture.componentRef.setInput('hash', null);
    expect(component.torrent()).toBeUndefined();
  });

  it('should look up torrent from the store when hash is set', () => {
    const torrentMap = new Map([['abc123', { name: 'Test', hash: 'abc123' } as any]]);
    (mockTorrentStore as any).torrentsMap = signal(torrentMap);

    const fixture2 = TestBed.createComponent(TorrentExists);
    const comp2 = fixture2.componentInstance;
    fixture2.componentRef.setInput('hash', 'abc123');
    expect(comp2.torrent()?.name).toBe('Test');
  });

  describe('closeModal', () => {
    it('should close the active modal', () => {
      component.closeModal();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  it('should expose originalPath as a signal input defaulting to null', () => {
    expect(component.originalPath()).toBeNull();
  });

  describe('auto-delete on duplicate', () => {
    it('does not call deleteFile when deleteTorrentFileOnDuplicate is off (the default in this suite)', async () => {
      const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile');

      fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(deleteFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('row selection on open', () => {
    it('should select and scroll to the torrent in the grid as soon as hash is set, before openDetails is called', () => {
      const mockSelectionStore = TestBed.inject(SelectionStoreService) as any;
      const mockCommandBus = TestBed.inject(CommandBusService) as any;

      fixture.componentRef.setInput('hash', 'abc123');
      fixture.detectChanges();

      expect(mockSelectionStore.setByHashes).toHaveBeenCalledWith(['abc123']);
      expect(mockCommandBus.emit).toHaveBeenCalledWith({
        type: 'UI_SCROLL_TO_TORRENT',
        hash: 'abc123',
      });
    });

    it('should not select or scroll, and should not touch active filters, when the torrent is hidden by the current filters', async () => {
      await TestBed.resetTestingModule();
      const mockSelectionStore = { setByHashes: vi.fn() };
      const mockCommandBus = { commands$: new Subject<any>().asObservable(), emit: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [TorrentExists],
        providers: [
          { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
          { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) as any } },
          { provide: SelectionStoreService, useValue: mockSelectionStore },
          { provide: FilterService, useValue: { filtered: signal([]) } },
          { provide: CommandBusService, useValue: mockCommandBus },
          {
            provide: GeneralSettingsService,
            useValue: {
              asObservable: vi.fn().mockReturnValue(
                of({
                  ...DEFAULT_GENERAL_SETTINGS,
                  behavior: { ...DEFAULT_GENERAL_SETTINGS.behavior, deleteTorrentFile: true },
                }),
              ),
            },
          },
          { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
        ],
      }).compileComponents();

      const hiddenFixture = TestBed.createComponent(TorrentExists);
      hiddenFixture.componentRef.setInput('hash', 'abc123');
      hiddenFixture.detectChanges();

      expect(mockSelectionStore.setByHashes).not.toHaveBeenCalled();
      expect(mockCommandBus.emit).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'UI_SCROLL_TO_TORRENT' }),
      );
    });
  });

  describe('openDetails', () => {
    it('should emit UI_OPEN_TORRENT_DETAILS', () => {
      const mockCommandBus = TestBed.inject(CommandBusService) as any;
      fixture.componentRef.setInput('hash', 'abc123');
      fixture.detectChanges();
      mockCommandBus.emit.mockClear();

      component.openDetails();

      expect(mockCommandBus.emit).toHaveBeenCalledWith({
        type: 'UI_OPEN_TORRENT_DETAILS',
        hash: 'abc123',
      });
    });
  });
});

describe('TorrentExists - auto-delete enabled', () => {
  let comp: TorrentExists;
  let fixture: ComponentFixture<TorrentExists>;
  let mockToastService: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockToastService = { success: vi.fn(), danger: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TorrentExists],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) as any } },
        { provide: SelectionStoreService, useValue: { setByHashes: vi.fn() } },
        { provide: FilterService, useValue: { filtered: signal([{ hash: 'abc123' } as Torrent]) } },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            asObservable: vi.fn().mockReturnValue(
              of({
                ...DEFAULT_GENERAL_SETTINGS,
                behavior: {
                  ...DEFAULT_GENERAL_SETTINGS.behavior,
                  deleteTorrentFile: true,
                  deleteTorrentFileOnDuplicate: true,
                },
              }),
            ),
          },
        },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentExists);
    comp = fixture.componentInstance;
  });

  it('automatically deletes the torrent file once originalPath is set', async () => {
    const deleteFileSpy = vi
      .spyOn(window.bitbutler.torrent, 'deleteFile')
      .mockResolvedValue({ ok: true });

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).toHaveBeenCalledWith({ path: '/tmp/test.torrent' });
    expect(comp.fileDeleted()).toBe(true);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('does not delete when originalPath is null', async () => {
    const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile');

    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).not.toHaveBeenCalled();
  });

  it('only attempts the delete once even if unrelated inputs change afterwards', async () => {
    const deleteFileSpy = vi
      .spyOn(window.bitbutler.torrent, 'deleteFile')
      .mockResolvedValue({ ok: true });

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a danger toast with the raw error when deleteFile fails, and does not mark fileDeleted', async () => {
    vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockRejectedValue(new Error('disk error'));

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.fileDeleted()).toBe(false);
    expect(mockToastService.danger).toHaveBeenCalledWith(
      'disk error',
      'components.modals.torrent-exists.toast.delete-failed-title',
    );
  });

  it('shows a danger toast and does not mark fileDeleted when deleteFile resolves with ok: false', async () => {
    vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockResolvedValue({
      ok: false,
      error: 'EPERM: operation not permitted',
    });

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.fileDeleted()).toBe(false);
    expect(mockToastService.danger).toHaveBeenCalledWith(
      'EPERM: operation not permitted',
      'components.modals.torrent-exists.toast.delete-failed-title',
    );
  });
});
