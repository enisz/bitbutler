import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { UpdateAvailable } from './update-available';

describe('UpdateAvailable', () => {
  let component: UpdateAvailable;
  let fixture: ComponentFixture<UpdateAvailable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateAvailable],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateAvailable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
