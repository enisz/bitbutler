import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { DeleteTorrent } from './delete-torrent';

describe('DeleteTorrent', () => {
  let component: DeleteTorrent;
  let fixture: ComponentFixture<DeleteTorrent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteTorrent],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
