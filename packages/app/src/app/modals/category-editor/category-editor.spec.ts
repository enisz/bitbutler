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
  let qbService: { torrents: { createCategory: ReturnType<typeof vi.fn> } };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let toastService: { danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    qbService = {
      torrents: {
        createCategory: vi.fn(),
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
});
