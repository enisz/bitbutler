import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { LimitTransferRate } from './limit-transfer-rate';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({ name: 'My Torrent', hash: 'abc123', up_limit: 0, dl_limit: 0, ...overrides }) as Torrent;

describe('LimitTransferRate', () => {
  let component: LimitTransferRate;
  let fixture: ComponentFixture<LimitTransferRate>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: any;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      getUploadLimit: vi.fn().mockResolvedValue(0),
      getDownloadLimit: vi.fn().mockResolvedValue(0),
      setUploadLimit: vi.fn().mockResolvedValue(undefined),
      setDownloadLimit: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LimitTransferRate],
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
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LimitTransferRate);
    component = fixture.componentInstance;
    component.target = 'torrent';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('canSave', () => {
    it('should return true when form is valid and not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('should return false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('should return false when both limits are null', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('should return true when uploadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('should return true when downloadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: 1024,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });

  describe('tooltipText (global target)', () => {
    let globalComponent: LimitTransferRate;

    beforeEach(async () => {
      const f = TestBed.createComponent(LimitTransferRate);
      globalComponent = f.componentInstance;
      globalComponent.target = 'global';
      f.detectChanges();
    });

    it('should return null for global target', () => {
      expect(globalComponent.tooltipText()).toBeNull();
    });

    it('should return non-null for torrent target', () => {
      expect(component.tooltipText()).toBeDefined();
    });
  });
});
