---
title: 'First Steps'
order: 3
---

# Magna Aliqua Ut Enim

Ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla.

## Pariatur Excepteur Sint

Occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

```typescript
import { effect, signal } from '@angular/core';

const dolor = signal<string | null>(null);
const sit = signal(0);

effect(() => {
  const current = dolor();
  if (current !== null) {
    console.log(`Amet: ${current} (iteration ${sit()})`);
  }
});

// Consectetur adipiscing
dolor.set('lorem ipsum');
sit.update((n) => n + 1);
```

### Totam Rem Aperiam

Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia.

### Consequuntur Magni Dolores

Eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore.

## Magna Aliquam Quaerat

Voluptatem ut enim ad minima veniam quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi consequatur quis autem vel eum iure reprehenderit qui in ea.

```bash
# Voluptate velit esse
lorem --mode interactive --dolor sit --amet true

# Quam nihil molestiae
lorem list --filter "ipsum > 0" --sort consectetur --limit 25

# Vel illum qui dolorem
lorem delete --id abc123 --confirm
lorem export --format json --output ./backup.json
```

### Eum Fugiat Quo Voluptas

Nulla pariatur at vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati.

## Cupiditate Non Provident

Similique sunt in culpa qui officia deserunt mollitia animi id est laborum et dolorum fuga. See [Configuration](configuration) to revisit settings · [Features](../features) for what's available · [Architecture](../architecture) to go deeper.

---

You're all set! Back to [Installation](installation) · [Home](../index)
