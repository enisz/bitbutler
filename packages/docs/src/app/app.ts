import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'bb-docs-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar navbar-expand-md bg-body border-bottom sticky-top">
      <div class="container">
        <a class="navbar-brand fw-bold" routerLink="/">BitButler</a>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMenu"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navMenu">
          <ul class="navbar-nav ms-auto gap-1">
            @for (link of navLinks; track link.path) {
              <li class="nav-item">
                <a
                  class="nav-link"
                  [routerLink]="link.path"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: link.path === '/' }"
                >
                  {{ link.label }}
                </a>
              </li>
            }
          </ul>
        </div>
      </div>
    </nav>
    <router-outlet />
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AppComponent {
  readonly navLinks = [
    { path: '/', label: 'Home' },
    { path: '/features', label: 'Features' },
    { path: '/architecture', label: 'Architecture' },
    { path: '/development', label: 'Development' },
  ];
}
