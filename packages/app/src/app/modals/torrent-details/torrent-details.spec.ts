import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ModalGuardService } from '../../services/modal-guard.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { TorrentDetails } from './torrent-details';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';

describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let commands$: Subject<any>;
  let mockDataService: {
    activeTabId: ReturnType<typeof signal<any>>;
    localPath: ReturnType<typeof signal<string | null>>;
    singleFile: ReturnType<typeof signal<boolean>>;
    torrent: ReturnType<typeof signal<any>>;
    selectTab: ReturnType<typeof vi.fn>;
    init: ReturnType<typeof vi.fn>;
    stopAll: ReturnType<typeof vi.fn>;
  };
  let mockActionsService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    commands$ = new Subject();
    const activeTabIdSignal = signal<any>('general');
    mockDataService = {
      activeTabId: activeTabIdSignal,
      localPath: signal<string | null>(null),
      singleFile: signal(false),
      torrent: signal<any>(null),
      selectTab: vi.fn((id: any) => activeTabIdSignal.set(id)),
      init: vi.fn(),
      stopAll: vi.fn(),
    };
    mockActionsService = {
      deleteTorrent: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      forceResume: vi.fn(),
      openTransferLimitsModal: vi.fn(),
      openShareLimitsModal: vi.fn(),
      rename: vi.fn(),
      setLocation: vi.fn(),
      openPath: vi.fn(),
      changeCategory: vi.fn(),
      removeCategory: vi.fn(),
      changeTags: vi.fn(),
      removeAllTags: vi.fn(),
      forceReannounce: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: vi.fn() },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    })
      .overrideComponent(TorrentDetails, {
        set: {
          providers: [
            ModalGuardService,
            { provide: TorrentDetailsDataService, useValue: mockDataService },
            { provide: TorrentDetailsActionsService, useValue: mockActionsService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TorrentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 tabs defined', () => {
    expect(component.tabs).toHaveLength(4);
  });

  it('should default to the general tab', () => {
    expect(component.activeTabId()).toBe('general');
  });

  describe('selectTab', () => {
    it('delegates to the data service and reflects the change', () => {
      component.selectTab('trackers');
      expect(mockDataService.selectTab).toHaveBeenCalledWith('trackers');
      expect(component.activeTabId()).toBe('trackers');
    });
  });

  describe('torrent computed', () => {
    it('should return null when no hash is set', () => {
      fixture.componentRef.setInput('hash', null);
      expect(component.torrent()).toBeNull();
    });
  });

  describe('ngOnInit', () => {
    it('initializes the data service with the hash and context inputs', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      fixture.componentRef.setInput('context', { editMode: true });
      await component.ngOnInit();
      expect(mockDataService.init).toHaveBeenCalledWith('abc123', { editMode: true });
    });

    it('selects the tabToOpen input on the data service', async () => {
      fixture.componentRef.setInput('tabToOpen', 'content');
      await component.ngOnInit();
      expect(mockDataService.selectTab).toHaveBeenCalledWith('content');
    });
  });

  describe('canDeactivate', () => {
    it('should return true without confirmation when guard is not dirty', async () => {
      component.guardService.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
    });
  });

  describe('TORRENT_DELETED handling', () => {
    it('stops the data service and closes the modal when this torrent is deleted', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      await component.ngOnInit();

      commands$.next({ type: 'TORRENT_DELETED', hash: 'abc123' });

      expect(mockDataService.stopAll).toHaveBeenCalled();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('ignores TORRENT_DELETED events for a different hash', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      await component.ngOnInit();

      commands$.next({ type: 'TORRENT_DELETED', hash: 'other-hash' });

      expect(mockDataService.stopAll).not.toHaveBeenCalled();
      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });

  describe('footer actions', () => {
    it('delete button calls actionsService.deleteTorrent', () => {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        '.modal-footer .btn-danger',
      );
      button.click();
      expect(mockActionsService['deleteTorrent']).toHaveBeenCalled();
    });

    it('reannounce button calls actionsService.forceReannounce', () => {
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      const reannounceButton = items.find((b) => b.textContent?.includes('force-reannounce'));
      reannounceButton?.click();
      expect(mockActionsService['forceReannounce']).toHaveBeenCalled();
    });

    describe('manage dropdown open-destination item', () => {
      it('is absent when there is no localPath', () => {
        mockDataService.localPath.set(null);
        fixture.detectChanges();
        const items: HTMLButtonElement[] = Array.from(
          fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
        );
        expect(items.some((i) => i.textContent?.includes('open-destination'))).toBe(false);
      });

      it('is present when there is a localPath', () => {
        mockDataService.localPath.set('/local/path');
        fixture.detectChanges();
        const items: HTMLButtonElement[] = Array.from(
          fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
        );
        const openDestinationItem = items.find((i) => i.textContent?.includes('open-destination'));
        expect(openDestinationItem).toBeDefined();
        openDestinationItem?.click();
        expect(mockActionsService['openPath']).toHaveBeenCalled();
      });
    });
  });
});
