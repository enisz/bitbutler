import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
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

describe('ShareLimit', () => {
  let component: ShareLimit;
  let fixture: ComponentFixture<ShareLimit>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ShareLimit],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: SelectionStoreService,
          useValue: {
            selected: signal([makeTorrent()]) as any,
            selectedHashes: vi.fn().mockReturnValue(['abc123']),
          },
        },
        {
          provide: QbService,
          useValue: {
            getAppPreferences: vi.fn().mockResolvedValue({
              max_ratio_enabled: false,
              max_ratio: 0,
              max_seeding_time_enabled: false,
              max_seeding_time: 0,
              max_inactive_seeding_time_enabled: false,
              max_inactive_seeding_time: null,
            }),
            setShareLimits: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareLimit);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('canSave', () => {
    it('should return true when not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('should return false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('should return false when all limits are null', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('should return true when ratioLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: 2.0,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('should return true when seedingTimeLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });
});
