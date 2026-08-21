import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';
import { About } from './about';

describe('About', () => {
  let component: About;
  let fixture: ComponentFixture<About>;
  let mockElectronService: Partial<ElectronService>;
  let mockThemeService: Partial<ThemeService>;

  beforeEach(async () => {
    mockElectronService = {
      getBitButlerVersion: vi.fn().mockReturnValue('1.2.3'),
      getBitButlerReleaseDate: vi.fn().mockReturnValue(null),
      openExternalUrl: vi.fn(),
      goToRelease: vi.fn(),
    };

    mockThemeService = {
      family: signal('bitbutler') as any,
    };

    await TestBed.configureTestingModule({
      imports: [About],
      providers: [
        NgbActiveModal,
        { provide: ElectronService, useValue: mockElectronService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the tagline', () => {
    expect(component.tagline).toBe('The Digital Butler for your Torrents');
  });

  it('should derive logoUrl from theme family', () => {
    expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-bitbutler.png');
  });

  it('should call openExternalUrl on electronService', () => {
    component.openExternalUrl('https://example.com');
    expect(mockElectronService.openExternalUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('should call goToRelease on electronService', () => {
    component.goToRelease();
    expect(mockElectronService.goToRelease).toHaveBeenCalled();
  });

  it('should load version from electronService', () => {
    expect(component.version).toBe('1.2.3');
  });
});
