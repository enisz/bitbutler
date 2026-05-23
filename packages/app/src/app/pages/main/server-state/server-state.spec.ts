import { NO_ERRORS_SCHEMA, SimpleChanges, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { QbPollingService } from '../../../services/qb-polling.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';
import { ServerState } from './server-state';

function makeSimpleChanges(currentValue: any): SimpleChanges {
  return {
    state: { currentValue, previousValue: null, firstChange: true, isFirstChange: () => true },
  };
}

describe('ServerState', () => {
  let component: ServerState;
  let fixture: ComponentFixture<ServerState>;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let selectedSignal: ReturnType<typeof signal<any[]>>;
  let filteredCountSignal: ReturnType<typeof signal<number>>;
  let onPoll$: Subject<void>;

  beforeEach(async () => {
    commandBusEmit = vi.fn();
    selectedSignal = signal<any[]>([]);
    filteredCountSignal = signal<number>(0);
    onPoll$ = new Subject<void>();

    await TestBed.configureTestingModule({
      imports: [ServerState],
      providers: [
        { provide: SelectionStoreService, useValue: { selected: selectedSignal } },
        { provide: GridViewStoreService, useValue: { filteredCount: filteredCountSignal } },
        {
          provide: StatusBarSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
        {
          provide: QbPollingService,
          useValue: { onPoll$: onPoll$.asObservable(), getPollingInterval: () => 2000 },
        },
        { provide: CommandBusService, useValue: { emit: commandBusEmit } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerState);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial signal values', () => {
    it('should start with diskSpace of 0n', () => {
      expect(component.diskSpace()).toBe(0n);
    });

    it('should start with dlSpeed of 0n', () => {
      expect(component.dlSpeed()).toBe(0n);
    });

    it('should start with upSpeed of 0n', () => {
      expect(component.upSpeed()).toBe(0n);
    });

    it('should start with dlLimit of 0n', () => {
      expect(component.dlLimit()).toBe(0n);
    });

    it('should start with upLimit of 0n', () => {
      expect(component.upLimit()).toBe(0n);
    });

    it('should start with allTimeDl of 0n', () => {
      expect(component.allTimeDl()).toBe(0n);
    });

    it('should start with allTimeUl of 0n', () => {
      expect(component.allTimeUl()).toBe(0n);
    });

    it('should start with dhtNodes of 0', () => {
      expect(component.dhtNodes()).toBe(0);
    });

    it('should start with connectionStatus of offline', () => {
      expect(component.connectionStatus()).toBe('offline');
    });

    it('should start with sessionRatio of 0.00', () => {
      expect(component.sessionRatio()).toBe('0.00');
    });

    it('should start with globalRatio of 0.00', () => {
      expect(component.globalRatio()).toBe('0.00');
    });

    it('should start with useAltSpeedLimits false', () => {
      expect(component.useAltSpeedLimits()).toBe(false);
    });

    it('should start with pollingInterval derived from polling service', () => {
      expect(component.pollingInterval()).toBe('2');
    });
  });

  describe('ngOnChanges', () => {
    describe('when state is null', () => {
      beforeEach(() => {
        component.ngOnChanges(makeSimpleChanges({ free_space_on_disk: 999, dht_nodes: 42 }));
        component.ngOnChanges(makeSimpleChanges(null));
      });

      it('should reset diskSpace to 0n', () => {
        expect(component.diskSpace()).toBe(0n);
      });

      it('should reset dlSpeed to 0n', () => {
        expect(component.dlSpeed()).toBe(0n);
      });

      it('should reset upSpeed to 0n', () => {
        expect(component.upSpeed()).toBe(0n);
      });

      it('should reset allTimeDl to 0n', () => {
        expect(component.allTimeDl()).toBe(0n);
      });

      it('should reset allTimeUl to 0n', () => {
        expect(component.allTimeUl()).toBe(0n);
      });

      it('should reset dhtNodes to 0', () => {
        expect(component.dhtNodes()).toBe(0);
      });

      it('should reset connectionStatus to offline', () => {
        expect(component.connectionStatus()).toBe('offline');
      });

      it('should reset sessionRatio to 0.00', () => {
        expect(component.sessionRatio()).toBe('0.00');
      });

      it('should reset globalRatio to 0.00', () => {
        expect(component.globalRatio()).toBe('0.00');
      });

      it('should reset useAltSpeedLimits to false', () => {
        expect(component.useAltSpeedLimits()).toBe(false);
      });
    });

    describe('bigint fields', () => {
      it('should apply free_space_on_disk to diskSpace', () => {
        component.ngOnChanges(makeSimpleChanges({ free_space_on_disk: 1024 }));
        expect(component.diskSpace()).toBe(1024n);
      });

      it('should apply dl_info_speed to dlSpeed', () => {
        component.ngOnChanges(makeSimpleChanges({ dl_info_speed: 5000 }));
        expect(component.dlSpeed()).toBe(5000n);
      });

      it('should apply up_info_speed to upSpeed', () => {
        component.ngOnChanges(makeSimpleChanges({ up_info_speed: 3000 }));
        expect(component.upSpeed()).toBe(3000n);
      });

      it('should apply dl_rate_limit to dlLimit', () => {
        component.ngOnChanges(makeSimpleChanges({ dl_rate_limit: 100000 }));
        expect(component.dlLimit()).toBe(100000n);
      });

      it('should apply up_rate_limit to upLimit', () => {
        component.ngOnChanges(makeSimpleChanges({ up_rate_limit: 50000 }));
        expect(component.upLimit()).toBe(50000n);
      });

      it('should apply alltime_dl to allTimeDl', () => {
        component.ngOnChanges(makeSimpleChanges({ alltime_dl: 1_000_000 }));
        expect(component.allTimeDl()).toBe(1_000_000n);
      });

      it('should apply alltime_ul to allTimeUl', () => {
        component.ngOnChanges(makeSimpleChanges({ alltime_ul: 500_000 }));
        expect(component.allTimeUl()).toBe(500_000n);
      });

      it('should truncate fractional values for bigint fields', () => {
        component.ngOnChanges(makeSimpleChanges({ free_space_on_disk: 1024.9 }));
        expect(component.diskSpace()).toBe(1024n);
      });

      it('should skip bigint fields that are null', () => {
        component.ngOnChanges(makeSimpleChanges({ free_space_on_disk: 999 }));
        component.ngOnChanges(makeSimpleChanges({ free_space_on_disk: null }));
        expect(component.diskSpace()).toBe(999n);
      });
    });

    describe('connection_status', () => {
      it('should update connectionStatus when present', () => {
        component.ngOnChanges(makeSimpleChanges({ connection_status: 'connected' }));
        expect(component.connectionStatus()).toBe('connected');
      });

      it('should fall back to offline when connection_status is falsy', () => {
        component.ngOnChanges(makeSimpleChanges({ connection_status: '' }));
        expect(component.connectionStatus()).toBe('offline');
      });

      it('should not update connectionStatus when key is absent', () => {
        component.ngOnChanges(makeSimpleChanges({ connection_status: 'firewalled' }));
        component.ngOnChanges(makeSimpleChanges({}));
        expect(component.connectionStatus()).toBe('firewalled');
      });
    });

    describe('dht_nodes', () => {
      it('should update dhtNodes when present', () => {
        component.ngOnChanges(makeSimpleChanges({ dht_nodes: 128 }));
        expect(component.dhtNodes()).toBe(128);
      });

      it('should fall back to 0 when dht_nodes is falsy', () => {
        component.ngOnChanges(makeSimpleChanges({ dht_nodes: 0 }));
        expect(component.dhtNodes()).toBe(0);
      });
    });

    describe('global_ratio', () => {
      it('should update globalRatio when present', () => {
        component.ngOnChanges(makeSimpleChanges({ global_ratio: '1.23' }));
        expect(component.globalRatio()).toBe('1.23');
      });

      it('should fall back to 0.00 when global_ratio is falsy', () => {
        component.ngOnChanges(makeSimpleChanges({ global_ratio: '' }));
        expect(component.globalRatio()).toBe('0.00');
      });
    });

    describe('use_alt_speed_limits', () => {
      it('should set useAltSpeedLimits true when present and truthy', () => {
        component.ngOnChanges(makeSimpleChanges({ use_alt_speed_limits: true }));
        expect(component.useAltSpeedLimits()).toBe(true);
      });

      it('should set useAltSpeedLimits false when present and false', () => {
        component.ngOnChanges(makeSimpleChanges({ use_alt_speed_limits: true }));
        component.ngOnChanges(makeSimpleChanges({ use_alt_speed_limits: false }));
        expect(component.useAltSpeedLimits()).toBe(false);
      });
    });

    describe('sessionRatio', () => {
      it('should calculate ratio as ul/dl when dl_info_data > 0', () => {
        component.ngOnChanges(makeSimpleChanges({ dl_info_data: 1000, up_info_data: 500 }));
        expect(component.sessionRatio()).toBe('0.50');
      });

      it('should set sessionRatio to 0.00 when dl_info_data is 0', () => {
        component.ngOnChanges(makeSimpleChanges({ dl_info_data: 0, up_info_data: 500 }));
        expect(component.sessionRatio()).toBe('0.00');
      });

      it('should set sessionRatio to 0.00 when dl_info_data is absent', () => {
        component.ngOnChanges(makeSimpleChanges({}));
        expect(component.sessionRatio()).toBe('0.00');
      });

      it('should produce ratio greater than 1 when ul exceeds dl', () => {
        component.ngOnChanges(makeSimpleChanges({ dl_info_data: 100, up_info_data: 300 }));
        expect(component.sessionRatio()).toBe('3.00');
      });
    });
  });

  describe('toggleAlternativeSpeedLimit', () => {
    it('should emit TRANSFER_LIMIT_ALTERNATIVE_TOGGLE command', () => {
      component.toggleAlternativeSpeedLimit();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    });
  });

  describe('setGlobalTransferLimit', () => {
    it('should emit UI_LIMIT_TRANSFER command with global target', () => {
      component.setGlobalTransferLimit();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_LIMIT_TRANSFER', target: 'global' });
    });
  });

  describe('setGlobalShareLimit', () => {
    it('emits UI_LIMIT_SHARE with global target', () => {
      component.setGlobalShareLimit();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_LIMIT_SHARE',
        target: 'global',
      });
    });
  });

  describe('selectedCount', () => {
    it('should reflect the number of selected torrents', () => {
      selectedSignal.set([{ hash: 'abc' }, { hash: 'def' }] as any);
      fixture.detectChanges();
      expect(component.selectedCount()).toBe(2);
    });

    it('should return 0 when selection is empty', () => {
      selectedSignal.set([]);
      fixture.detectChanges();
      expect(component.selectedCount()).toBe(0);
    });
  });

  describe('filteredCount', () => {
    it('should reflect the filtered torrent count from the grid view store', () => {
      filteredCountSignal.set(42);
      fixture.detectChanges();
      expect(component.filteredCount()).toBe(42);
    });
  });
});
