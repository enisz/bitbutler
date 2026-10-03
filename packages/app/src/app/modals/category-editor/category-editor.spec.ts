import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { CategoryEditor } from './category-editor';

describe('CategoryEditor', () => {
  let fixture: ComponentFixture<CategoryEditor>;
  let component: CategoryEditor;
  let qbService: {
    torrents: { createCategory: ReturnType<typeof vi.fn>; editCategory: ReturnType<typeof vi.fn> };
  };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let toastService: { danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    qbService = {
      torrents: {
        createCategory: vi.fn(),
        editCategory: vi.fn(),
      },
    };
    commandBusService = { emit: vi.fn() };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };
    toastService = { danger: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CategoryEditor],
      providers: [
        { provide: QbService, useValue: qbService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ServerStoreService, useValue: { currentServerId: () => 'srv-1' } },
        { provide: ToastService, useValue: toastService },
        { provide: TranslateService, useFactory: mockTranslateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryEditor);
    component = fixture.componentInstance;
  });

  it('creates a category with the given name and save path, emits CATEGORY_ADDED, and closes', async () => {
    component.nameControl.setValue('movies');
    component.savePathControl.setValue('/data/movies');
    qbService.torrents.createCategory.mockResolvedValue(undefined);

    await component.save();

    expect(qbService.torrents.createCategory).toHaveBeenCalledWith(
      'srv-1',
      'movies',
      '/data/movies',
    );
    expect(commandBusService.emit).toHaveBeenCalledWith({
      type: 'CATEGORY_ADDED',
      name: 'movies',
      savePath: '/data/movies',
    });
    expect(activeModal.close).toHaveBeenCalled();
  });

  it('does not save when the name is blank', async () => {
    component.nameControl.setValue('  ');
    component.savePathControl.setValue('/data/movies');

    await component.save();

    expect(qbService.torrents.createCategory).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  it('creates a category with a blank save path, passing an empty string through (Finding 4: save path is optional)', async () => {
    component.nameControl.setValue('movies');
    component.savePathControl.setValue('   ');
    qbService.torrents.createCategory.mockResolvedValue(undefined);

    await component.save();

    expect(qbService.torrents.createCategory).toHaveBeenCalledWith('srv-1', 'movies', '');
    expect(commandBusService.emit).toHaveBeenCalledWith({
      type: 'CATEGORY_ADDED',
      name: 'movies',
      savePath: '',
    });
    expect(activeModal.close).toHaveBeenCalled();
  });

  describe('duplicate name validation', () => {
    it('flags the name as invalid when it matches an existing category', () => {
      fixture.componentRef.setInput('existingNames', ['movies', 'tv']);
      component.nameControl.setValue('movies');

      expect(component.nameControl.hasError('duplicateName')).toBe(true);
    });

    it('is valid when the name does not match any existing category', () => {
      fixture.componentRef.setInput('existingNames', ['movies', 'tv']);
      component.nameControl.setValue('software');

      expect(component.nameControl.valid).toBe(true);
    });

    it('does not flag an empty value as a duplicate', () => {
      fixture.componentRef.setInput('existingNames', ['movies']);
      component.nameControl.setValue('  ');

      expect(component.nameControl.hasError('duplicateName')).toBe(false);
    });

    it('does not save a duplicate name', async () => {
      fixture.componentRef.setInput('existingNames', ['movies']);
      component.nameControl.setValue('movies');
      component.savePathControl.setValue('/data/movies');

      await component.save();

      expect(qbService.torrents.createCategory).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('error handling (Finding 3)', () => {
    it('shows a danger toast and keeps the modal open when createCategory fails', async () => {
      component.nameControl.setValue('movies');
      component.savePathControl.setValue('/data/movies');
      qbService.torrents.createCategory.mockRejectedValue(new Error('409 conflict'));

      await component.save();

      expect(toastService.danger).toHaveBeenCalled();
      expect(commandBusService.emit).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    it('prefills the name and save path, and disables the name field, since qBittorrent has no rename API', () => {
      fixture.componentRef.setInput('category', { name: 'movies', savePath: '/data/movies' });

      fixture.detectChanges();

      expect(component.nameControl.value).toBe('movies');
      expect(component.nameControl.disabled).toBe(true);
      expect(component.savePathControl.value).toBe('/data/movies');
    });

    it('updates the save path via editCategory, emits CATEGORY_UPDATED, and closes', async () => {
      fixture.componentRef.setInput('category', { name: 'movies', savePath: '/data/movies' });
      fixture.detectChanges();
      component.savePathControl.setValue('/data/movies-2');
      qbService.torrents.editCategory.mockResolvedValue(undefined);

      await component.save();

      expect(qbService.torrents.editCategory).toHaveBeenCalledWith(
        'srv-1',
        'movies',
        '/data/movies-2',
      );
      expect(qbService.torrents.createCategory).not.toHaveBeenCalled();
      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'CATEGORY_UPDATED',
        name: 'movies',
        savePath: '/data/movies-2',
      });
      expect(activeModal.close).toHaveBeenCalled();
    });

    it('shows a danger toast and keeps the modal open when editCategory fails', async () => {
      fixture.componentRef.setInput('category', { name: 'movies', savePath: '/data/movies' });
      fixture.detectChanges();
      qbService.torrents.editCategory.mockRejectedValue(new Error('409 conflict'));

      await component.save();

      expect(toastService.danger).toHaveBeenCalled();
      expect(commandBusService.emit).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });
});
