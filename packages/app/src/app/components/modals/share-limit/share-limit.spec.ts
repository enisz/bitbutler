import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ShareLimit } from './share-limit';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({
    name: 'My Torrent',
    hash: 'abc123',
    ratio_limit: -1,
    seeding_time_limit: -1,
    inactive_seeding_time_limit: -1,
    ...overrides,
  }) as Torrent;

const makeStore = (torrents: Torrent[] = []) => signal(new Map(torrents.map((t) => [t.hash, t])));

describe('ShareLimit', () => {
  let component: ShareLimit;
  let fixture: ComponentFixture<ShareLimit>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: any;
  let mockToastService: { danger: ReturnType<typeof vi.fn> };
  let torrentsMap: ReturnType<typeof makeStore>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      app: {
        preferences: vi.fn().mockResolvedValue({
          max_ratio_enabled: true,
          max_ratio: 2.0,
          max_seeding_time_enabled: false,
          max_seeding_time: 0,
          max_inactive_seeding_time_enabled: false,
          max_inactive_seeding_time: null,
        }),
        setPreferences: vi.fn().mockResolvedValue(undefined),
      },
      torrents: {
        setShareLimits: vi.fn().mockResolvedValue(undefined),
      },
    };
    mockToastService = { danger: vi.fn() };

    torrentsMap = makeStore([makeTorrent()]);

    await TestBed.configureTestingModule({
      imports: [ShareLimit],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap },
        },
        { provide: QbService, useValue: mockQbService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareLimit);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('torrent target - single hash with negative limits (use global)', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123']);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('leaves all form fields null when ratio_limit and time limits are -1', () => {
      const v = component.form.controls.shareLimits.value;
      expect(v?.ratioLimit).toBeNull();
      expect(v?.seedingTimeLimit).toBeNull();
      expect(v?.inactiveSeedingTimeLimit).toBeNull();
    });

    it('does not call getAppPreferences', () => {
      expect(mockQbService.app.preferences).not.toHaveBeenCalled();
    });

    it('loading stays false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('torrent target - single hash with explicit limits', () => {
    beforeEach(async () => {
      torrentsMap.set(
        new Map([
          [
            'abc123',
            makeTorrent({
              ratio_limit: 1.5,
              seeding_time_limit: 120,
              inactive_seeding_time_limit: 30,
            }),
          ],
        ]),
      );
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123']);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('populates ratioLimit from ratio_limit', () => {
      expect(component.form.controls.shareLimits.value?.ratioLimit).toBe(1.5);
    });

    it('populates seedingTimeLimit from seeding_time_limit', () => {
      expect(component.form.controls.shareLimits.value?.seedingTimeLimit).toBe(120);
    });

    it('populates inactiveSeedingTimeLimit from inactive_seeding_time_limit', () => {
      expect(component.form.controls.shareLimits.value?.inactiveSeedingTimeLimit).toBe(30);
    });
  });

  describe('torrent target - multiple hashes', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123', 'def456']);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('leaves all form fields null for multi-selection', () => {
      const v = component.form.controls.shareLimits.value;
      expect(v?.ratioLimit).toBeNull();
      expect(v?.seedingTimeLimit).toBeNull();
      expect(v?.inactiveSeedingTimeLimit).toBeNull();
    });

    it('does not call getAppPreferences', () => {
      expect(mockQbService.app.preferences).not.toHaveBeenCalled();
    });
  });

  describe('global target', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('target', 'global');
      fixture.componentRef.setInput('hashes', []);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('calls getAppPreferences', () => {
      expect(mockQbService.app.preferences).toHaveBeenCalledWith('server-1');
    });

    it('populates ratioLimit when max_ratio_enabled is true', () => {
      expect(component.form.controls.shareLimits.value?.ratioLimit).toBe(2.0);
    });

    it('leaves seedingTimeLimit null when max_seeding_time_enabled is false', () => {
      expect(component.form.controls.shareLimits.value?.seedingTimeLimit).toBeNull();
    });

    it('loading ends as false after init', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('selectionName', () => {
    it('returns torrent name for single hash', () => {
      fixture.componentRef.setInput('hashes', ['abc123']);
      expect(component.selectionName()).toBe('My Torrent');
    });

    it('returns count for multiple hashes', () => {
      fixture.componentRef.setInput('hashes', ['abc123', 'def456']);
      expect(component.selectionName()).toBe(2);
    });
  });

  describe('tooltipText', () => {
    it('returns null for global target', () => {
      fixture.componentRef.setInput('target', 'global');
      fixture.componentRef.setInput('hashes', []);
      expect(component.tooltipText()).toBeNull();
    });

    it('returns string for torrent target', () => {
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123']);
      expect(component.tooltipText()).toBe('My Torrent');
    });
  });

  describe('canSave', () => {
    it('returns true when not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('returns false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('returns false when all limits are null', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('returns true when ratioLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: 2.0,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('returns true when seedingTimeLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });

  describe('handleSubmit - torrent target', () => {
    it('calls setShareLimits with component hashes', async () => {
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123']);
      component.form.controls.shareLimits.setValue({
        ratioLimit: 1.5,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      await component.handleSubmit();
      expect(mockQbService.torrents.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        1.5,
        -1,
        -1,
      );
    });

    it('shows a danger toast with the raw error when setShareLimits fails', async () => {
      fixture.componentRef.setInput('target', 'torrent');
      fixture.componentRef.setInput('hashes', ['abc123']);
      mockQbService.torrents.setShareLimits.mockRejectedValueOnce(new Error('disk full'));

      await component.handleSubmit();

      expect(mockToastService.danger).toHaveBeenCalledWith(
        'disk full',
        'components.modals.share-limit.toast.set-failed-title',
      );
    });
  });

  describe('handleSubmit - global target', () => {
    it('calls setAppPreferences with enabled flags', async () => {
      fixture.componentRef.setInput('target', 'global');
      fixture.componentRef.setInput('hashes', []);
      component.form.controls.shareLimits.setValue({
        ratioLimit: 2.0,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      await component.handleSubmit();
      expect(mockQbService.app.setPreferences).toHaveBeenCalledWith('server-1', {
        max_ratio_enabled: true,
        max_ratio: 2.0,
        max_seeding_time_enabled: false,
        max_seeding_time: 0,
        max_inactive_seeding_time_enabled: false,
        max_inactive_seeding_time: undefined,
      });
    });
  });
});
