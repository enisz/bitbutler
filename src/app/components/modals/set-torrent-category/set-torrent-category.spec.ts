import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetTorrentCategory } from './set-torrent-category';

describe('SetTorrentCategory', () => {
  let component: SetTorrentCategory;
  let fixture: ComponentFixture<SetTorrentCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentCategory],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentCategory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
