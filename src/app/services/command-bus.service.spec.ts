import { TestBed } from '@angular/core/testing';
import { CommandBusService } from './command-bus.service';

describe('CommandBusService', () => {
  let service: CommandBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CommandBusService] });
    service = TestBed.inject(CommandBusService);
  });

  it('should emit commands to subscribers', () => {
    const received: any[] = [];
    service.commands$.subscribe((cmd) => received.push(cmd));

    service.emit({ type: 'TORRENT_PAUSE' } as any);
    service.emit({ type: 'TORRENT_RESUME' } as any);

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('TORRENT_PAUSE');
    expect(received[1].type).toBe('TORRENT_RESUME');
  });

  it('should not replay past commands to new subscribers', () => {
    service.emit({ type: 'TORRENT_PAUSE' } as any);

    const received: any[] = [];
    service.commands$.subscribe((cmd) => received.push(cmd));

    expect(received).toHaveLength(0);
  });

  it('should broadcast to multiple subscribers', () => {
    const first: any[] = [];
    const second: any[] = [];

    service.commands$.subscribe((cmd) => first.push(cmd));
    service.commands$.subscribe((cmd) => second.push(cmd));

    service.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false } as any);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
