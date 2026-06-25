import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '@bitbutler/shared';
import { ModalGuardService } from '../../../../services/modal-guard.service';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Content } from './content';

describe('Content', () => {
  let component: Content;
  let fixture: ComponentFixture<Content>;
  let mockDataService: {
    content: ReturnType<typeof signal<TorrentFileEntry[]>>;
    contentLoading: ReturnType<typeof signal<boolean>>;
    context: ReturnType<typeof signal<Record<string, any>>>;
    setContent: ReturnType<typeof vi.fn>;
  };
  let mockActionsService: { saveFileChanges: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDataService = {
      content: signal([]),
      contentLoading: signal(true),
      context: signal({}),
      setContent: vi.fn(),
    };
    mockActionsService = { saveFileChanges: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [Content],
      providers: [
        ModalGuardService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: mockActionsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Content);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty content list', () => {
    expect(component.content()).toHaveLength(0);
  });

  it('should start with loading = true', () => {
    expect(component.loading()).toBe(true);
  });

  describe('context effect', () => {
    it('should not set startInEditMode when context has no editMode flag', () => {
      mockDataService.context.set({});
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(false);
    });

    it('should set startInEditMode and clear the flag when context.editMode is true', () => {
      const ctx: Record<string, any> = { editMode: true };
      mockDataService.context.set(ctx);
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(true);
      expect(ctx['editMode']).toBe(false);
    });
  });

  describe('onSaved', () => {
    it('optimistically sets content and delegates the mutation to the actions service', async () => {
      const originalContent: TorrentFileEntry[] = [{ path: 'a.txt', length: 1, index: 0 }];
      mockDataService.content.set(originalContent);
      const event = {
        files: [{ path: 'b.txt', length: 1, index: 0 }],
        renames: [{ oldPath: 'a.txt', newPath: 'b.txt' }],
      };

      await component.onSaved(event);

      expect(mockDataService.setContent).toHaveBeenCalledWith(event.files);
      expect(mockActionsService.saveFileChanges).toHaveBeenCalledWith(event, originalContent);
    });
  });

  describe('onEditModeChange', () => {
    it('marks the modal guard dirty when editing starts', () => {
      component.onEditModeChange(true);
      expect(TestBed.inject(ModalGuardService).isDirty()).toBe(true);
    });
  });
});
