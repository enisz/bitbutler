import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Peers } from './peers';

describe('Peers', () => {
  let component: Peers;
  let fixture: ComponentFixture<Peers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Peers],
    }).compileComponents();

    fixture = TestBed.createComponent(Peers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
