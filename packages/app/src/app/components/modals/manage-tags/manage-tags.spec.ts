import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['movies', 'linux']),
      createTags: vi.fn().mockResolvedValue(undefined),
      deleteTags: vi.fn().mockResolvedValue(undefined),
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ConfirmService, useValue: mockConfirmService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set loading to false after init completes', () => {
    expect(component.loading()).toBe(false);
  });

  it('should load tags sorted alphabetically', () => {
    expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
    expect(component.tags()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new tag', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['software']);
      expect(component.tags()).toContain('software');
      expect(component.nameControl.value).toBeNull();
    });

    it('should maintain alphabetical order after adding a new tag', async () => {
      component.nameControl.setValue('alpha');
      await component.add();
      expect(component.tags()[0]).toBe('alpha');
    });

    it('should not add when name is empty', async () => {
      component.nameControl.setValue('');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.nameControl.setValue('   ');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should show a confirm dialog before deleting', async () => {
      await component.delete('linux');
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should delete when the user confirms', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      await component.delete('linux');
      expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.tags()).not.toContain('linux');
      expect(component.tags()).toContain('movies');
    });

    it('should not delete when the user cancels', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await component.delete('linux');
      expect(mockQbService.deleteTags).not.toHaveBeenCalled();
      expect(component.tags()).toContain('linux');
    });
  });
});
