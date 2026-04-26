import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { SelectionStoreService } from '../../../services/selection-store.service';
import { DeleteTorrent } from './delete-torrent';

describe('DeleteTorrent', () => {
  let component: DeleteTorrent;
  let fixture: ComponentFixture<DeleteTorrent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockSelectionStore: Partial<SelectionStoreService>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockSelectionStore = {
      selected: signal([]) as any,
      selectedHashes: vi.fn().mockReturnValue([]) as any,
    };

    await TestBed.configureTestingModule({
      imports: [DeleteTorrent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: SelectionStoreService, useValue: mockSelectionStore },
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
    component.defaultRemoveFiles = true;
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
});
