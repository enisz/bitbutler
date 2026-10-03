import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { TagEditor } from './tag-editor';

describe('TagEditor', () => {
  let fixture: ComponentFixture<TagEditor>;
  let component: TagEditor;
  let qbService: { torrents: { createTags: ReturnType<typeof vi.fn> } };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let toastService: { danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    qbService = {
      torrents: {
        createTags: vi.fn(),
      },
    };
    commandBusService = { emit: vi.fn() };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };
    toastService = { danger: vi.fn() };

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
        { provide: ToastService, useValue: toastService },
        { provide: TranslateService, useFactory: mockTranslateService },
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

  describe('deduping against already-existing tags (Finding 5)', () => {
    it('filters out names that already exist in the grid before calling createTags, and only reports the new ones', async () => {
      fixture.componentRef.setInput('existingNames', ['existingTag']);
      component.nameControl.setValue('linux, linux, existingTag');
      qbService.torrents.createTags.mockResolvedValue(undefined);

      await component.save();

      expect(qbService.torrents.createTags).toHaveBeenCalledWith('srv-1', ['linux']);
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TAG_ADDED', names: ['linux'] });
      expect(activeModal.close).toHaveBeenCalled();
    });

    it('does not call createTags or emit TAG_ADDED when every submitted name already exists, but still closes the modal', async () => {
      fixture.componentRef.setInput('existingNames', ['existingTag']);
      component.nameControl.setValue('existingTag');

      await component.save();

      expect(qbService.torrents.createTags).not.toHaveBeenCalled();
      expect(commandBusService.emit).not.toHaveBeenCalled();
      expect(activeModal.close).toHaveBeenCalled();
    });
  });

  describe('error handling (Finding 3)', () => {
    it('shows a danger toast and keeps the modal open when createTags fails', async () => {
      component.nameControl.setValue('linux');
      qbService.torrents.createTags.mockRejectedValue(new Error('network error'));

      await component.save();

      expect(toastService.danger).toHaveBeenCalled();
      expect(commandBusService.emit).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });
});
