import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagEditor } from './tag-editor';

describe('TagEditor', () => {
  let fixture: ComponentFixture<TagEditor>;
  let component: TagEditor;
  let qbService: { torrents: { createTags: ReturnType<typeof vi.fn> } };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    qbService = {
      torrents: {
        createTags: vi.fn(),
      },
    };
    commandBusService = { emit: vi.fn() };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagEditor],
      providers: [
        { provide: QbService, useValue: qbService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbActiveModal, useValue: activeModal },
        {
          provide: ServerStoreService,
          useValue: { currentServer: () => ({ id: 'srv-1' }), currentServerId: () => 'srv-1' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagEditor);
    component = fixture.componentInstance;
  });

  it('splits a comma-separated input into multiple tag names, trimmed and de-duplicated of blanks', async () => {
    component.nameControl.setValue(' linux ,  ubuntu,, debian ');
    qbService.torrents.createTags.mockResolvedValue(undefined);

    await component.save();

    expect(qbService.torrents.createTags).toHaveBeenCalledWith('srv-1', [
      'linux',
      'ubuntu',
      'debian',
    ]);
  });

  it('de-duplicates repeated names within the same submission before calling createTags (Review Focus: duplicate/overlapping tag names on create)', async () => {
    component.nameControl.setValue('linux, linux, ubuntu');
    qbService.torrents.createTags.mockResolvedValue(undefined);

    await component.save();

    expect(qbService.torrents.createTags).toHaveBeenCalledWith('srv-1', ['linux', 'ubuntu']);
  });

  it('emits TAG_ADDED with the created names and closes on success', async () => {
    component.nameControl.setValue('linux');
    qbService.torrents.createTags.mockResolvedValue(undefined);

    await component.save();

    expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TAG_ADDED', names: ['linux'] });
    expect(activeModal.close).toHaveBeenCalled();
  });

  it('does not call createTags or close when the input is blank', async () => {
    component.nameControl.setValue('   ');

    await component.save();

    expect(qbService.torrents.createTags).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });
});
