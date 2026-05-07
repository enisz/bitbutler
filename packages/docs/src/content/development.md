---
title: 'Development'
order: 4
slug: 'development'
---

# Itaque Earum Rerum Hic

Tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. Nam libero tempore, cum soluta nobis est eligendi optio.

## Cumque Nihil Impedit

Quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et.

```bash
git clone https://github.com/enisz/bitbutler.git
cd bitbutler
npm install
npm start
```

### Voluptates Repudiandae

Sint et molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus. Ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat sed do.

```typescript
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoremService {
  private readonly _dolor = signal<string[]>([]);
  private readonly _sit = signal(0);

  readonly amet = computed(() => this._dolor().length > this._sit());

  readonly consectetur = computed(() => this._dolor().map((item) => item.toUpperCase()));

  add(item: string): void {
    this._dolor.update((prev) => [...prev, item]);
    this._sit.update((n) => n + 1);
  }

  reset(): void {
    this._dolor.set([]);
    this._sit.set(0);
  }
}
```

### Similique Sunt In Culpa

Officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore cum soluta nobis est eligendi optio cumque nihil.

## Temporibus Autem Quibusdam

Et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus ut aut.

```scss
@use 'bootstrap/scss/functions' as *;
@use 'bootstrap/scss/variables' as *;

$lorem-primary: hsl(220, 90%, 56%);
$lorem-spacing: 1.5rem;

.ipsum-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: $lorem-spacing;

  &__item {
    background-color: var(--bs-card-bg, #{$white});
    border: 1px solid var(--bs-border-color);
    border-radius: var(--bs-border-radius-lg);
    padding: $lorem-spacing;
    transition: box-shadow 0.2s ease;

    &:hover {
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
    }
  }
}
```

## Reiciendis Voluptatibus Maiores

Alias consequatur aut perferendis doloribus asperiores repellat. Nam libero tempore cum soluta nobis est eligendi optio. See [Architecture](architecture) for structural context · [Features](features) for what's built.

### Ut Et Voluptates

Repudiandae sint et molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus. Ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.

---

Open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
