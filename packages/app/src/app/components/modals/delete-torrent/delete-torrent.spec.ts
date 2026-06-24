import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { DeleteTorrent } from './delete-torrent';

describe('DeleteTorrent', () => {
  let component: DeleteTorrent;
  let fixture: ComponentFixture<DeleteTorrent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockSelectionStore: Partial<SelectionStoreService>;
  let mockTorrentStore: { torrentsMap: ReturnType<typeof signal<Map<string, any>>> };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockSelectionStore = {
      selected: signal([]) as any,
      selectedHashes: vi.fn().mockReturnValue([]) as any,
    };
    mockTorrentStore = { torrentsMap: signal(new Map()) };

    await TestBed.configureTestingModule({
      imports: [DeleteTorrent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: SelectionStoreService, useValue: mockSelectionStore },
        { provide: TorrentStoreService, useValue: mockTorrentStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise removeFiles control to false by default', () => {
    expect(component.deleteForm.get('removeFiles')?.value).toBe(false);
  });

  it('should initialise removeFiles to true when defaultRemoveFiles is true', async () => {
    fixture.componentRef.setInput('defaultRemoveFiles', true);
    component.ngOnInit();
    expect(component.deleteForm.get('removeFiles')?.value).toBe(true);
  });

  describe('closeModal', () => {
    it('should close the modal with the removeFiles flag', () => {
      component.deleteForm.get('removeFiles')?.setValue(true);
      component.closeModal();
      expect(mockActiveModal.close).toHaveBeenCalledWith({ removeFiles: true });
    });
  });

  describe('dismissModal', () => {
    it('should dismiss the modal', () => {
      component.dismissModal();
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('selected', () => {
    it('falls back to the selection store when no hashes override is set', () => {
      const torrent = { hash: 'abc', size: 100 } as any;
      (mockSelectionStore.selected as any).set([torrent]);

      expect(component.selected()).toEqual([torrent]);
    });

    it('resolves torrents from the store when a hashes override is set', () => {
      const torrent = { hash: 'xyz', size: 500 } as any;
      mockTorrentStore.torrentsMap.set(new Map([['xyz', torrent]]));
      fixture.componentRef.setInput('hashes', ['xyz']);

      expect(component.selected()).toEqual([torrent]);
    });

    it('ignores hashes that are missing from the torrent store', () => {
      mockTorrentStore.torrentsMap.set(new Map());
      fixture.componentRef.setInput('hashes', ['missing']);

      expect(component.selected()).toEqual([]);
    });
  });
});
