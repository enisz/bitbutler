import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';
import { NavRail } from './nav-rail';

describe('NavRail', () => {
  let fixture: ComponentFixture<NavRail>;
  let router: Router;
  let commandBusEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    commandBusEmit = vi.fn();

    await TestBed.configureTestingModule({
      imports: [NavRail, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          {
            path: 'pages',
            children: [
              {
                path: 'torrent-list',
                children: [],
              },
            ],
          },
        ]),
        { provide: CommandBusService, useValue: { emit: commandBusEmit } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavRail);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render exactly one link, to the torrent list route', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/pages/torrent-list');
  });

  it('should render an icon in the link', () => {
    const icon = fixture.nativeElement.querySelector('fa-icon');
    expect(icon).toBeTruthy();
  });

  it('should give the torrent list link an accessible label', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('aria-label')).toBeTruthy();
  });

  it('should reflect the active route', async () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    await router.navigateByUrl('/pages/torrent-list');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(link.classList.contains('active')).toBe(true);
  });

  describe('bottom actions', () => {
    function getButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('button'));
    }

    it('should render an About button above a Disconnect button', () => {
      const buttons = getButtons();
      expect(buttons.length).toBe(2);
      expect(buttons[0].getAttribute('aria-label')).toBeTruthy();
      expect(buttons[1].getAttribute('aria-label')).toBeTruthy();
    });

    it('should emit UI_OPEN_ABOUT when the About button is clicked', () => {
      const [aboutButton] = getButtons();
      aboutButton.click();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_OPEN_ABOUT' });
    });

    it('should emit UI_DISCONNECT when the Disconnect button is clicked', () => {
      const [, disconnectButton] = getButtons();
      disconnectButton.click();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_DISCONNECT' });
    });
  });
});
