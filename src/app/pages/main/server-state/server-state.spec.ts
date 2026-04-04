import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerState } from './server-state';

describe('ServerState', () => {
  let component: ServerState;
  let fixture: ComponentFixture<ServerState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerState],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerState);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
