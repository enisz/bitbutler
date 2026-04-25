import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalGuardService } from '../../../../services/modal-guard.service';

import { Content } from './content';

describe('Content', () => {
  let component: Content;
  let fixture: ComponentFixture<Content>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Content],
      providers: [ModalGuardService],
    }).compileComponents();

    fixture = TestBed.createComponent(Content);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
