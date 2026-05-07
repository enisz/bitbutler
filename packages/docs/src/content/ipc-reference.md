---
title: 'IPC Reference'
order: 31
slug: 'ipc-reference'
parent: 'architecture'
---

# Perferendis Doloribus Asperiores

Repellat nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est omnis dolor.

## Voluptas Assumenda Est

Omnis dolor repellendus temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae itaque.

```typescript
// Earum rerum hic tenetur
interface DolorNamespace {
  getSit(id: string): Promise<SitResult>;
  setSit(id: string, value: unknown): Promise<void>;
  deleteSit(id: string): Promise<boolean>;
  listSit(filter?: SitFilter): Promise<SitResult[]>;
}

interface SitResult {
  id: string;
  lorem: string;
  ipsum: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SitFilter {
  lorem?: string;
  ipsum?: { min?: number; max?: number };
  limit?: number;
  offset?: number;
}
```

### Sapiente Delectus Ut

Aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. Nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo.

### Minus Id Quod Maxime

Placeat facere possimus omnis voluptas assumenda est omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates.

## Repudiandae Sint Et

Molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat nam libero.

```typescript
// Tempore cum soluta nobis
async function consecteturCall<T>(channel: string, payload: unknown): Promise<T> {
  const response = await window.bitbutler.lorem.invoke(channel, payload);

  if (!response.ok) {
    throw new LoremError(response.code, response.message);
  }

  return response.data as T;
}

class LoremError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'LoremError';
  }
}
```

### Eligendi Optio Cumque

Nihil impedit quo minus id quod maxime placeat facere possimus. Omnis voluptas assumenda est omnis dolor repellendus temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus.

## Saepe Eveniet Ut et

Voluptates repudiandae sint et molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus. See [Architecture](architecture) for the full design · [Development](development) to contribute.

```bash
# Temporibus autem quibusdam
lorem-ipc listen --channel dolor.sit --format json
lorem-ipc send dolor.sit '{"amet": true, "consectetur": 42}'
lorem-ipc replay --from-file ./fixtures/ipsum.ndjson
```

---

Open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
