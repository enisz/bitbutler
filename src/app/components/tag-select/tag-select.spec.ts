import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagSelect } from './tag-select';

describe('TagSelect', () => {
  let component: TagSelect;
  let fixture: ComponentFixture<TagSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagSelect],
    }).compileComponents();

    fixture = TestBed.createComponent(TagSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
