import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteTorrent } from './delete-torrent';

describe('DeleteTorrent', () => {
  let component: DeleteTorrent;
  let fixture: ComponentFixture<DeleteTorrent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteTorrent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
