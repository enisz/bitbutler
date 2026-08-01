import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from './command-bus.service';
import { CredentialPromptService } from './credential-prompt.service';
import { ServerService } from './server.service';

describe('CredentialPromptService', () => {
  let service: CredentialPromptService;
  let modalMock: { open: ReturnType<typeof vi.fn> };
  let serverServiceMock: { update: ReturnType<typeof vi.fn> };
  let commandBusMock: { emit: ReturnType<typeof vi.fn> };

  function makeModalRef(result: Promise<unknown>) {
    const componentInstance: Record<string, unknown> = {};
    return {
      componentInstance,
      result,
      _contentRef: {
        componentRef: {
          setInput: vi.fn((name: string, value: unknown) => {
            componentInstance[name] = value;
          }),
        },
      },
    };
  }

  beforeEach(() => {
    modalMock = { open: vi.fn() };
    serverServiceMock = { update: vi.fn().mockResolvedValue(true) };
    commandBusMock = { emit: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: NgbModal, useValue: modalMock },
        { provide: ServerService, useValue: serverServiceMock },
        { provide: CommandBusService, useValue: commandBusMock },
      ],
    });

    service = TestBed.inject(CredentialPromptService);
  });

  describe('needsPrompt', () => {
    it('returns true when username is missing', () => {
      expect(service.needsPrompt({ username: '', has_password: true })).toBe(true);
    });

    it('returns true when has_password is false', () => {
      expect(service.needsPrompt({ username: 'admin', has_password: false })).toBe(true);
    });

    it('returns false when both are present', () => {
      expect(service.needsPrompt({ username: 'admin', has_password: true })).toBe(false);
    });
  });

  describe('resolve', () => {
    const server = { id: 'srv-1', name: 'My Server', username: '', has_password: false };

    it('opens the credential prompt with the server name and prefilled username', async () => {
      const modalRef = makeModalRef(Promise.resolve({ username: '', password: '', save: false }));
      modalMock.open.mockReturnValue(modalRef);

      await service.resolve(server);

      expect(modalRef.componentInstance['serverName']).toBe('My Server');
      expect(modalRef.componentInstance['prefillUsername']).toBe('');
    });

    it('returns null when the prompt is cancelled', async () => {
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      modalMock.open.mockReturnValue(makeModalRef(cancelled));

      const result = await service.resolve(server);

      expect(result).toBeNull();
    });

    it('persists credentials and returns an empty object when the prompt saves', async () => {
      modalMock.open.mockReturnValue(
        makeModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: true })),
      );

      const result = await service.resolve(server);

      expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', {
        username: 'admin',
        password: 'secret',
      });
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
      expect(result).toEqual({});
    });

    it('returns the entered credentials without persisting when the prompt does not save', async () => {
      modalMock.open.mockReturnValue(
        makeModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: false })),
      );

      const result = await service.resolve(server);

      expect(serverServiceMock.update).not.toHaveBeenCalled();
      expect(result).toEqual({ username: 'admin', password: 'secret' });
    });
  });
});
