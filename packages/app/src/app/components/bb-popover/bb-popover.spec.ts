import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbPopover } from './bb-popover';

describe('BbPopover', () => {
  let component: BbPopover;
  let fixture: ComponentFixture<BbPopover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbPopover],
    }).compileComponents();

    fixture = TestBed.createComponent(BbPopover);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default subject to empty string', () => {
    expect(component.subject).toBe('');
  });

  it('should default description to empty string', () => {
    expect(component.description).toBe('');
  });

  it('should default placement to right', () => {
    expect(component.placement).toBe('right');
  });

  it('should accept subject input', () => {
    component.subject = 'Test subject';
    expect(component.subject).toBe('Test subject');
  });

  it('should accept description input', () => {
    component.description = 'Some description';
    expect(component.description).toBe('Some description');
  });

  it('should accept custom placement', () => {
    component.placement = 'top';
    expect(component.placement).toBe('top');
  });
});
