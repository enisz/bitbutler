import { TestBed } from '@angular/core/testing';
import { PlatformService } from './platform.service';
import { ViewportService } from './viewport.service';

type Listener = () => void;

class FakeMediaQuery {
  public matches = false;
  private readonly listeners = new Set<Listener>();

  addEventListener(_type: string, listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: Listener): void {
    this.listeners.delete(listener);
  }

  set(matches: boolean): void {
    this.matches = matches;
    this.listeners.forEach((listener) => listener());
  }
}

describe('ViewportService', () => {
  const queries = new Map<string, FakeMediaQuery>();
  const originalMatchMedia = window.matchMedia;

  const query = (name: 'phone' | 'tablet' | 'touch'): FakeMediaQuery => {
    const key = [...queries.keys()].find((k) =>
      name === 'phone'
        ? k === '(max-width: 767.98px)'
        : name === 'tablet'
          ? k.includes('min-width: 768px')
          : k.includes('pointer: coarse'),
    );
    return queries.get(key as string) as FakeMediaQuery;
  };

  beforeEach(() => {
    queries.clear();
    window.matchMedia = ((q: string) => {
      if (!queries.has(q)) queries.set(q, new FakeMediaQuery());
      return queries.get(q);
    }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('is desktop and not touch when no query matches', () => {
    const service = TestBed.inject(ViewportService);
    expect(service.layout()).toBe('desktop');
    expect(service.isDesktop()).toBe(true);
    expect(service.isTouch()).toBe(false);
  });

  it('is phone when only the phone query matches', () => {
    const service = TestBed.inject(ViewportService);
    query('phone').set(true);
    expect(service.layout()).toBe('phone');
    expect(service.isPhone()).toBe(true);
  });

  it('is tablet when only the tablet query matches', () => {
    const service = TestBed.inject(ViewportService);
    query('tablet').set(true);
    expect(service.layout()).toBe('tablet');
    expect(service.isTablet()).toBe(true);
  });

  it('reports touch independently of the layout', () => {
    const service = TestBed.inject(ViewportService);
    query('touch').set(true);
    expect(service.isTouch()).toBe(true);
    expect(service.layout()).toBe('desktop');
  });

  it('updates the layout when a query changes', () => {
    const service = TestBed.inject(ViewportService);
    query('phone').set(true);
    expect(service.layout()).toBe('phone');
    query('phone').set(false);
    expect(service.layout()).toBe('desktop');
  });

  describe('platform', () => {
    const withPlatform = (isMobile: boolean): ViewportService => {
      TestBed.configureTestingModule({
        providers: [{ provide: PlatformService, useValue: { isMobile } }],
      });
      return TestBed.inject(ViewportService);
    };

    it('layout is phone on mobile platform at desktop width', () => {
      const service = withPlatform(true);
      expect(service.layout()).toBe('phone');
      expect(service.isPhone()).toBe(true);
    });

    it('layout is phone on mobile platform at tablet width', () => {
      const service = withPlatform(true);
      query('tablet').set(true);
      expect(service.layout()).toBe('phone');
      expect(service.isTablet()).toBe(false);
    });

    it('isDesktop is false on mobile platform', () => {
      const service = withPlatform(true);
      expect(service.isDesktop()).toBe(false);
    });

    it('desktop platform keeps width-based layout', () => {
      const service = withPlatform(false);
      expect(service.layout()).toBe('desktop');
      query('tablet').set(true);
      expect(service.layout()).toBe('tablet');
      query('tablet').set(false);
      query('phone').set(true);
      expect(service.layout()).toBe('phone');
    });
  });

  it('defaults to desktop when matchMedia is unavailable', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    const service = TestBed.inject(ViewportService);
    expect(service.layout()).toBe('desktop');
    expect(service.isTouch()).toBe(false);
  });
});
