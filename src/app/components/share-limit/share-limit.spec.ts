import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShareLimit } from './share-limit';

describe('ShareLimit', () => {
  let component: ShareLimit;
  let fixture: ComponentFixture<ShareLimit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareLimit],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareLimit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
