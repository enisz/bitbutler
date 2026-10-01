import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { CategoryEditor } from './category-editor';

describe('CategoryEditor', () => {
  let fixture: ComponentFixture<CategoryEditor>;
  let component: CategoryEditor;
  let qbService: { torrents: { createCategory: ReturnType<typeof vi.fn> } };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    qbService = {
      torrents: {
        createCategory: vi.fn(),
      },
    };
    commandBusService = { emit: vi.fn() };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CategoryEditor],
      providers: [
        { provide: QbService, useValue: qbService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ServerStoreService, useValue: { currentServerId: () => 'srv-1' } },
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

  it('does not save when the save path is blank', async () => {
    component.nameControl.setValue('movies');
    component.savePathControl.setValue('   ');

    await component.save();

    expect(qbService.torrents.createCategory).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });
});
