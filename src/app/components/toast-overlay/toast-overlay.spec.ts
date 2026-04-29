import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Toast } from '../../models/toast.model';
import { ToastService } from '../../services/toast.service';
import { ToastOverlay } from './toast-overlay';

describe('ToastOverlay', () => {
  let component: ToastOverlay;
  let fixture: ComponentFixture<ToastOverlay>;
  let mockToastService: Partial<ToastService>;

  const makeToast = (id: string, type: Toast['type'] = 'success'): Toast => ({
    id,
    type,
    title: `Title ${id}`,
    html: `<p>Message ${id}</p>`,
    duration: 3000,
    isClosing: false,
  });

  beforeEach(async () => {
    mockToastService = {
      dismiss: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ToastOverlay],
      providers: [{ provide: ToastService, useValue: mockToastService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with no toasts', () => {
    expect(component.toasts()).toHaveLength(0);
  });

  describe('add', () => {
    it('should append a toast to the list', () => {
      component.add(makeToast('t1'));
      expect(component.toasts()).toHaveLength(1);
      expect(component.toasts()[0].id).toBe('t1');
    });

    it('should append multiple toasts', () => {
      component.add(makeToast('t1'));
      component.add(makeToast('t2'));
      expect(component.toasts()).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('should remove the toast with the given id', () => {
      component.add(makeToast('t1'));
      component.add(makeToast('t2'));
      component.remove('t1');
      expect(component.toasts()).toHaveLength(1);
      expect(component.toasts()[0].id).toBe('t2');
    });

    it('should not throw when removing a non-existent id', () => {
      expect(() => component.remove('unknown')).not.toThrow();
    });
  });

  describe('beginDismiss', () => {
    it('should mark the toast with isClosing = true', () => {
      component.add(makeToast('t1'));
      component.beginDismiss('t1');
      expect(component.toasts()[0].isClosing).toBe(true);
    });

    it('should not affect other toasts', () => {
      component.add(makeToast('t1'));
      component.add(makeToast('t2'));
      component.beginDismiss('t1');
      expect(component.toasts()[1].isClosing).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should delegate to the toast service', () => {
      component.dismiss('t1');
      expect(mockToastService.dismiss).toHaveBeenCalledWith('t1');
    });
  });

  describe('onEnter / onLeave', () => {
    it('should pause the timer via toast service', () => {
      component.onEnter('t1');
      expect(mockToastService.pause).toHaveBeenCalledWith('t1');
    });

    it('should resume the timer via toast service', () => {
      component.onLeave('t1');
      expect(mockToastService.resume).toHaveBeenCalledWith('t1');
    });
  });

  describe('iconFor', () => {
    it('should return an icon for each toast type', () => {
      const types: Toast['type'][] = [
        'primary',
        'secondary',
        'success',
        'danger',
        'warning',
        'info',
        'light',
        'dark',
      ];
      for (const type of types) {
        expect(component.iconFor(type)).toBeDefined();
      }
    });
  });

  describe('position', () => {
    it('should default to bottom-right', () => {
      expect(component.position()).toBe('bottom-right');
    });

    it('should update when set directly', () => {
      component.position.set('top-left');
      expect(component.position()).toBe('top-left');
    });
  });
});
