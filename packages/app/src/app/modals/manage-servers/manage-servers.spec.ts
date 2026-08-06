import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { ManageServers } from './manage-servers';

describe('ManageServers', () => {
  let component: ManageServers;
  let fixture: ComponentFixture<ManageServers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageServers],
      providers: [
        {
          provide: ServerStoreService,
          useValue: {
            servers: signal([]),
            currentServerId: signal(null),
            select: vi.fn(),
          },
        },
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(false) } },
        {
          provide: QbService,
          useValue: { auth: { hasCookie: vi.fn(), login: vi.fn() } },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TranslateService, useFactory: mockTranslateService },
        { provide: NgbModal, useValue: { open: vi.fn() } },
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageServers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hideConnect', () => {
    it('should default to false', () => {
      expect(component.hideConnect()).toBe(false);
    });

    it('should hide the connect button when true', () => {
      const serverStoreMock = TestBed.inject(ServerStoreService) as any;
      serverStoreMock.servers.set([
        { id: 'srv-1', name: 'Test', host: 'localhost', port: 8080, protocol: 'http' },
      ]);
      serverStoreMock.currentServerId.set('other-id');
      fixture.componentRef.setInput('hideConnect', true);
      fixture.detectChanges();
      const connectBtn = fixture.nativeElement.querySelector('.connect-btn');
      expect(connectBtn).toBeNull();
    });

    it('should show the connect button when false', () => {
      const serverStoreMock = TestBed.inject(ServerStoreService) as any;
      serverStoreMock.servers.set([
        { id: 'srv-1', name: 'Test', host: 'localhost', port: 8080, protocol: 'http' },
      ]);
      serverStoreMock.currentServerId.set('other-id');
      fixture.componentRef.setInput('hideConnect', false);
      fixture.detectChanges();
      const connectBtn = fixture.nativeElement.querySelector('.connect-btn');
      expect(connectBtn).not.toBeNull();
    });
  });

  describe('switchTo', () => {
    it('should show a danger toast with the quoted server name and the failed-to-connect-title key when login fails', async () => {
      const server = {
        id: 'srv-1',
        name: 'My Server',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        username: 'admin',
        has_password: true,
      } as any;

      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);
      qbServiceMock.auth.login.mockResolvedValue({ loggedIn: false });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toastServiceMock = TestBed.inject(ToastService) as any;
      const translateServiceMock = TestBed.inject(TranslateService) as any;

      await component.switchTo(server);

      expect(errorSpy).toHaveBeenCalledWith(ManageServers.name, 'switchTo', expect.any(Error));
      expect(toastServiceMock.danger).toHaveBeenCalledWith('"My Server"', '');
      expect(translateServiceMock.instant).toHaveBeenCalledWith(
        'services.menu-bar-command-handler.error.failed-to-connect-title',
      );
    });

    describe('credential prompt', () => {
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

      function server(overrides: Record<string, unknown> = {}) {
        return {
          id: 'srv-1',
          name: 'My Server',
          host: 'localhost',
          port: 8080,
          protocol: 'http',
          username: '',
          has_password: false,
          ...overrides,
        } as any;
      }

      it('opens the credential prompt when there is no session and credentials are missing', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(false);

        const ngbModalMock = TestBed.inject(NgbModal) as any;
        const cancelled = Promise.reject(undefined);
        cancelled.catch(() => {});
        const modalRef = makeModalRef(cancelled);
        ngbModalMock.open.mockReturnValue(modalRef);

        await component.switchTo(server());

        expect(ngbModalMock.open).toHaveBeenCalledTimes(1);
        expect(modalRef.componentInstance['serverName']).toBe('My Server');
        expect(modalRef.componentInstance['prefillUsername']).toBe('');
        expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
      });

      it('skips the credential prompt when a session already exists', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(true);
        const ngbModalMock = TestBed.inject(NgbModal) as any;
        const serverStoreMock = TestBed.inject(ServerStoreService) as any;

        await component.switchTo(server());

        expect(ngbModalMock.open).not.toHaveBeenCalled();
        expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
        expect(serverStoreMock.select).toHaveBeenCalledWith('srv-1');
      });

      it('skips the credential prompt when credentials are already saved', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(false);
        qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });
        const ngbModalMock = TestBed.inject(NgbModal) as any;

        await component.switchTo(server({ username: 'admin', has_password: true }));

        expect(ngbModalMock.open).not.toHaveBeenCalled();
        expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
      });

      it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(false);
        qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });

        const ngbModalMock = TestBed.inject(NgbModal) as any;
        const modalRef = makeModalRef(
          Promise.resolve({ username: 'admin', password: 'secret', save: true }),
        );
        ngbModalMock.open.mockReturnValue(modalRef);

        const updateSpy = vi
          .spyOn(window.bitbutler.server, 'update')
          .mockResolvedValue({ updated: true });
        const commandBus = TestBed.inject(CommandBusService) as any;

        await component.switchTo(server());

        expect(updateSpy).toHaveBeenCalledWith({
          id: 'srv-1',
          changes: { username: 'admin', password: 'secret' },
        });
        expect(commandBus.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
        expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
      });

      it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(false);
        qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });

        const ngbModalMock = TestBed.inject(NgbModal) as any;
        const modalRef = makeModalRef(
          Promise.resolve({ username: 'admin', password: 'secret', save: false }),
        );
        ngbModalMock.open.mockReturnValue(modalRef);

        const updateSpy = vi.spyOn(window.bitbutler.server, 'update');

        await component.switchTo(server());

        expect(updateSpy).not.toHaveBeenCalled();
        expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', 'admin', 'secret');
      });

      it('aborts quietly without a toast when the credential prompt is cancelled', async () => {
        const qbServiceMock = TestBed.inject(QbService) as any;
        qbServiceMock.auth.hasCookie.mockResolvedValue(false);

        const ngbModalMock = TestBed.inject(NgbModal) as any;
        const cancelled = Promise.reject(undefined);
        cancelled.catch(() => {});
        const modalRef = makeModalRef(cancelled);
        ngbModalMock.open.mockReturnValue(modalRef);

        const toastServiceMock = TestBed.inject(ToastService) as any;

        await component.switchTo(server());

        expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
        expect(toastServiceMock.danger).not.toHaveBeenCalled();
        expect(component.connectingId()).toBeNull();
      });
    });
  });
});
