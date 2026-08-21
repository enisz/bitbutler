import { TestBed } from '@angular/core/testing';
import { faCheck, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;
  let mockModalRef: any;
  let mockModalService: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const componentInstance: Record<string, unknown> = {};
    mockModalRef = {
      componentInstance,
      result: Promise.resolve(true),
      _contentRef: {
        componentRef: {
          setInput: vi.fn((name: string, value: unknown) => {
            componentInstance[name] = value;
          }),
        },
      },
    };
    mockModalService = {
      open: vi.fn().mockReturnValue(mockModalRef),
    };

    TestBed.configureTestingModule({
      providers: [
        ConfirmService,
        { provide: NgbModal, useValue: mockModalService },
        { provide: TranslateService, useValue: {} },
      ],
    });

    service = TestBed.inject(ConfirmService);
  });

  it('should open a modal and resolve with true on confirm', async () => {
    mockModalRef.result = Promise.resolve(true);
    const result = await service.confirm('Title', 'Message');
    expect(result).toBe(true);
  });

  it('should resolve with false when modal is dismissed', async () => {
    // `confirm()` only attaches its own `.catch()` after an internal dynamic import() settles,
    // which is at least one microtask after this rejection is created. Attach a no-op `.catch()`
    // immediately so Vitest doesn't flag it as unhandled in that window - it doesn't change what
    // `confirm()` itself observes, since a promise can have multiple independent handlers.
    const dismissed = Promise.reject(undefined);
    dismissed.catch(() => {});
    mockModalRef.result = dismissed;
    const result = await service.confirm('Title', 'Message');
    expect(result).toBe(false);
  });

  it('should set title string on componentInstance', async () => {
    await service.confirm('My Title', 'My Message').catch(() => {});
    expect(mockModalRef.componentInstance.title).toBe('My Title');
  });

  it('should set message string on componentInstance', async () => {
    await service.confirm('T', 'My Message').catch(() => {});
    expect(mockModalRef.componentInstance.message).toBe('My Message');
  });

  it('should set titleParams when title is ParamWithData', async () => {
    await service.confirm({ text: 'key', data: { name: 'Test' } }, 'Message').catch(() => {});
    expect(mockModalRef.componentInstance.title).toBe('key');
    expect(mockModalRef.componentInstance.titleParams).toEqual({ name: 'Test' });
  });

  it('should set messageParams when message is ParamWithData', async () => {
    await service.confirm('Title', { text: 'msg.key', data: { count: 3 } }).catch(() => {});
    expect(mockModalRef.componentInstance.message).toBe('msg.key');
    expect(mockModalRef.componentInstance.messageParams).toEqual({ count: 3 });
  });

  it('should set custom button text', async () => {
    await service.confirm('T', 'M', 'custom.ok', 'custom.cancel').catch(() => {});
    expect(mockModalRef.componentInstance.btnOkText).toBe('custom.ok');
    expect(mockModalRef.componentInstance.btnCancelText).toBe('custom.cancel');
  });

  it('should use default dialog size of md', async () => {
    await service.confirm('T', 'M').catch(() => {});
    expect(mockModalService.open).toHaveBeenCalledWith(expect.anything(), { size: 'md' });
  });

  it('should use provided dialog size', async () => {
    await service.confirm('T', 'M', undefined, undefined, 'lg').catch(() => {});
    expect(mockModalService.open).toHaveBeenCalledWith(expect.anything(), { size: 'lg' });
  });

  it('should default okIcon to faCheck', async () => {
    await service.confirm('T', 'M').catch(() => {});
    expect(mockModalRef.componentInstance.okIcon).toBe(faCheck);
  });

  it('should set custom okIcon when provided', async () => {
    await service.confirm('T', 'M', undefined, undefined, undefined, faTrashCan).catch(() => {});
    expect(mockModalRef.componentInstance.okIcon).toBe(faTrashCan);
  });
});
