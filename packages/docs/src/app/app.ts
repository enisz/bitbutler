import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'bb-docs-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AppComponent {}
