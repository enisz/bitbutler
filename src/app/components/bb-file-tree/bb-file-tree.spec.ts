import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BbFileTree } from './bb-file-tree';

describe('BbFileTree', () => {
  let component: BbFileTree;
  let fixture: ComponentFixture<BbFileTree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbFileTree],
    }).compileComponents();

    fixture = TestBed.createComponent(BbFileTree);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
