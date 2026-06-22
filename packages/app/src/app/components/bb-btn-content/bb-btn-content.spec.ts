import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { BbBtnContent } from './bb-btn-content';

describe('BbBtnContent', () => {
  let component: BbBtnContent;
  let fixture: ComponentFixture<BbBtnContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbBtnContent],
    }).compileComponents();

    fixture = TestBed.createComponent(BbBtnContent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('icon', faCheck);
    fixture.componentRef.setInput('text', 'Save');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default position to start', () => {
    expect(component.position()).toBe('start');
  });

  it('should render the given text', () => {
    const textEl: HTMLElement = fixture.nativeElement.querySelector('.btn-text');
    expect(textEl.textContent?.trim()).toBe('Save');
  });

  it('should mark the icon span as aria-hidden', () => {
    const iconEl: HTMLElement = fixture.nativeElement.querySelector('.btn-icon');
    expect(iconEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render icon before text when position is start', () => {
    const children = Array.from(fixture.nativeElement.children) as HTMLElement[];
    expect(children.map((el) => el.className)).toEqual(['btn-icon', 'btn-text']);
  });

  it('should render icon after text when position is end', () => {
    fixture.componentRef.setInput('position', 'end');
    fixture.detectChanges();
    const children = Array.from(fixture.nativeElement.children) as HTMLElement[];
    expect(children.map((el) => el.className)).toEqual(['btn-text', 'btn-icon']);
  });
});
