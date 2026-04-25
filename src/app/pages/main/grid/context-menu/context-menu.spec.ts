import { OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenu } from './context-menu';
import { CONTEXT_MENU_CONFIG } from './context-menu.tokens';

describe('ContextMenu', () => {
  let component: ContextMenu;
  let fixture: ComponentFixture<ContextMenu>;

  beforeEach(async () => {
    const overlayRefMock = {
      dispose: vi.fn(),
      detach: vi.fn(),
      detachments: () => ({ pipe: () => ({ subscribe: vi.fn() }) }),
    };

    await TestBed.configureTestingModule({
      imports: [ContextMenu, OverlayModule],
      providers: [
        { provide: OverlayRef, useValue: overlayRefMock },
        { provide: CONTEXT_MENU_CONFIG, useValue: { items: [] } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
