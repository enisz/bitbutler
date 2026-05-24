import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetails } from './torrent-details';

describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: signal(new Map()) },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();

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
    it('should update the active tab id', () => {
      component.selectTab('trackers');
      expect(component.activeTabId()).toBe('trackers');
    });

    it('should switch to the peers tab', () => {
      component.selectTab('peers');
      expect(component.activeTabId()).toBe('peers');
    });
  });

  describe('torrent computed', () => {
    it('should return null when no hash is set', () => {
      fixture.componentRef.setInput('hash', null);
      expect(component.torrent()).toBeNull();
    });
  });

  describe('canDeactivate', () => {
    it('should return true without confirmation when guard is not dirty', async () => {
      component.guardService.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
    });
  });
});
