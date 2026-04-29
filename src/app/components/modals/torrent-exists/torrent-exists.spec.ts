import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentExists } from './torrent-exists';

describe('TorrentExists', () => {
  let component: TorrentExists;
  let fixture: ComponentFixture<TorrentExists>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockTorrentStore: Partial<TorrentStoreService>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockTorrentStore = {
      torrentsMap: signal(new Map()) as any,
    };

    await TestBed.configureTestingModule({
      imports: [TorrentExists],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: TorrentStoreService, useValue: mockTorrentStore },
        { provide: SelectionStoreService, useValue: { setByHashes: vi.fn() } },
        { provide: FilterService, useValue: { resetAll: vi.fn() } },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentExists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should store hash via the setter', () => {
    component.hash = 'abc123';
    expect(component.hash).toBe('abc123');
  });

  it('should return undefined torrent when hash is null', () => {
    component.hash = null;
    expect(component.torrent()).toBeUndefined();
  });

  it('should look up torrent from the store when hash is set', () => {
    const torrentMap = new Map([['abc123', { name: 'Test', hash: 'abc123' } as any]]);
    (mockTorrentStore as any).torrentsMap = signal(torrentMap);

    const fixture2 = TestBed.createComponent(TorrentExists);
    const comp2 = fixture2.componentInstance;
    comp2.hash = 'abc123';
    expect(comp2.torrent()?.name).toBe('Test');
  });

  describe('closeModal', () => {
    it('should close the active modal', () => {
      component.closeModal();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });
});
