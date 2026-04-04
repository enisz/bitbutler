import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trackers } from './trackers';

describe('Trackers', () => {
  let component: Trackers;
  let fixture: ComponentFixture<Trackers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trackers],
    }).compileComponents();

    fixture = TestBed.createComponent(Trackers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
