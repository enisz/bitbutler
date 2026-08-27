import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NavRail } from './nav-rail';

describe('NavRail', () => {
  let fixture: ComponentFixture<NavRail>;
  let router: Router;

  beforeEach(async () => {
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
});
