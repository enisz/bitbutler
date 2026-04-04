import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbProgress } from './bb-progress';

describe('BbProgressBar', () => {
  let component: BbProgress;
  let fixture: ComponentFixture<BbProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbProgress],
    }).compileComponents();

    fixture = TestBed.createComponent(BbProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
