import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageLabels } from './manage-labels';

describe('ManageLabels', () => {
  let component: ManageLabels;
  let fixture: ComponentFixture<ManageLabels>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['linux', 'movies']),
      createTags: vi.fn().mockResolvedValue(undefined),
      deleteTags: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ManageLabels],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageLabels);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load labels on init', () => {
    expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
    expect(component.labels()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new label', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['software']);
      expect(component.labels()).toContain('software');
      expect(component.nameControl.value).toBeNull();
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
    it('should call deleteTags and remove the label from the list', async () => {
      await component.delete('linux');
      expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.labels()).not.toContain('linux');
      expect(component.labels()).toContain('movies');
    });
  });
});
