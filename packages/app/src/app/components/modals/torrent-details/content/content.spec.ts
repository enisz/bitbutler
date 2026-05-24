import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalGuardService } from '../../../../services/modal-guard.service';
import { QbService } from '../../../../services/qb.service';
import { ServerSettingsService } from '../../../../services/server-settings.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { Content } from './content';

describe('Content', () => {
  let component: Content;
  let fixture: ComponentFixture<Content>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Content],
      providers: [
        ModalGuardService,
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: QbService,
          useValue: {
            torrentContents: vi.fn().mockResolvedValue([]),
            renameTorrentFile: vi.fn(),
            setFilePriority: vi.fn(),
          },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        {
          provide: ServerSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ polling: { foreground: 5000 } }),
          },
        },
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
      fixture.componentRef.setInput('context', {});
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(false);
    });

    it('should set startInEditMode and clear the flag when context.editMode is true', () => {
      const ctx: Record<string, any> = { editMode: true };
      fixture.componentRef.setInput('context', ctx);
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(true);
      expect(ctx['editMode']).toBe(false);
    });
  });
});
