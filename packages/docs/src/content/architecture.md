---
title: 'Architecture'
order: 3
slug: 'architecture'
---

# Perspiciatis Unde Omnis Iste

Natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Nemo Enim Ipsam Voluptatem

Quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit.

```typescript
interface LoremIpsum {
  dolor: string;
  sit: number;
  amet: boolean;
  consectetur?: {
    adipiscing: string[];
    elit: Record<string, unknown>;
  };
}

class DolorSitAmet implements LoremIpsum {
  constructor(
    public dolor: string,
    public sit: number,
    public amet: boolean,
  ) {}

  static fromJson(raw: unknown): DolorSitAmet {
    if (typeof raw !== 'object' || raw === null) {
      throw new TypeError('Expected object');
    }
    const { dolor, sit, amet } = raw as Record<string, unknown>;
    return new DolorSitAmet(String(dolor), Number(sit), Boolean(amet));
  }
}
```

### Ut Labore et Dolore

Magnam aliquam quaerat voluptatem ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi consequatur.

### Quis Autem Vel Eum

Iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.

## At Vero Eos et Accusamus

Et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

```bash
# Consectetur adipiscing elit setup
export LOREM_ENV=production
export IPSUM_PORT=8080
export DOLOR_HOST=localhost

# Sed do eiusmod tempor
npx lorem-ipsum init --dolor --sit-amet
npx lorem-ipsum serve --port $IPSUM_PORT --host $DOLOR_HOST

# Incididunt ut labore
npx lorem-ipsum build --output dist/lorem --minify
```

### Similique Sunt In Culpa

Qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio.

### Cumque Nihil Impedit

Quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.

## Ut Et Voluptates Repudiandae

Sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.

```json
{
  "lorem": "ipsum",
  "dolor": {
    "sit": 42,
    "amet": true,
    "consectetur": ["adipiscing", "elit", "sed"],
    "do": {
      "eiusmod": "tempor",
      "incididunt": false
    }
  },
  "labore": [1, 2, 3],
  "dolore": null
}
```

See [Features](features) for a full overview · [IPC Reference](ipc-reference) for the API surface · [Development](development) to get started.

---

Open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
