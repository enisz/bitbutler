import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { mockTranslateService } from '../../../test-utils/translate.mock';
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
      } as any;

      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);
      qbServiceMock.auth.login.mockResolvedValue({ loggedIn: false });

      const toastServiceMock = TestBed.inject(ToastService) as any;
      const translateServiceMock = TestBed.inject(TranslateService) as any;

      await component.switchTo(server);

      expect(toastServiceMock.danger).toHaveBeenCalledWith('"My Server"', '');
      expect(translateServiceMock.instant).toHaveBeenCalledWith(
        'services.menu-bar-command-handler.error.failed-to-connect-title',
      );
    });
  });
});
