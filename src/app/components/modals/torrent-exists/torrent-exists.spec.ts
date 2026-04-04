import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentExists } from './torrent-exists';

describe('TorrentExists', () => {
  let component: TorrentExists;
  let fixture: ComponentFixture<TorrentExists>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TorrentExists],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentExists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
