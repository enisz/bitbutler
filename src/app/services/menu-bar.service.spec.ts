import { TestBed } from '@angular/core/testing';
import { MenuBarService } from './menu-bar.service';

describe('MenuBarService', () => {
  it('should expose clicks$ observable', () => {
    TestBed.configureTestingModule({ providers: [MenuBarService] });
    const service = TestBed.inject(MenuBarService);
    expect(service.clicks$).toBeDefined();
  });

  it('should emit menu clicks through clicks$', () => {
    let capturedCallback: (p: any) => void = () => {};
    vi.spyOn(window.bitbutler.menu, 'onClick').mockImplementation((cb: any) => {
      capturedCallback = cb;
      return () => {};
    });

    TestBed.configureTestingModule({ providers: [MenuBarService] });
    const svc = TestBed.inject(MenuBarService);

    const received: any[] = [];
    svc.clicks$.subscribe((click) => received.push(click));

    capturedCallback({ action: 'file.addTorrent', ts: 1 });
    expect(received).toHaveLength(1);
    expect(received[0].action).toBe('file.addTorrent');
  });
});
