import { TestBed } from '@angular/core/testing';
import { QbServerState } from '../models/torrent.model';
import { ServerStateStoreService } from './server-state-store.service';

describe('ServerStateStoreService', () => {
  let service: ServerStateStoreService;

  const state = (fields: Record<string, unknown>) => fields as unknown as QbServerState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServerStateStoreService);
  });

  it('starts empty', () => {
    expect(service.state()).toBeNull();
  });

  it('takes the first patch as is', () => {
    service.merge(state({ connection_status: 'connected', dl_info_speed: 1 }));

    expect(service.state()).toEqual({ connection_status: 'connected', dl_info_speed: 1 });
  });

  it('merges later patches over the earlier state and keeps untouched fields', () => {
    service.merge(state({ connection_status: 'connected', dl_info_speed: 1 }));

    service.merge(state({ dl_info_speed: 5 }));

    expect(service.state()).toEqual({ connection_status: 'connected', dl_info_speed: 5 });
  });

  it('ignores empty patches and undefined values', () => {
    service.merge(state({ connection_status: 'connected' }));

    service.merge(null);
    service.merge(undefined);
    service.merge(state({ connection_status: undefined }));

    expect(service.state()).toEqual({ connection_status: 'connected' });
  });

  it('keeps the state when the same server is used again', () => {
    service.useServer('server-1');
    service.merge(state({ connection_status: 'connected' }));

    service.useServer('server-1');

    expect(service.state()).toEqual({ connection_status: 'connected' });
  });

  it('forgets the state when a different server is used', () => {
    service.useServer('server-1');
    service.merge(state({ connection_status: 'connected' }));

    service.useServer('server-2');

    expect(service.state()).toBeNull();
  });

  it('forgets the state when no server is selected any more', () => {
    service.useServer('server-1');
    service.merge(state({ connection_status: 'connected' }));

    service.useServer(null);

    expect(service.state()).toBeNull();
  });
});
