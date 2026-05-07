---
title: 'Home'
order: 1
slug: 'index'
---

# Lorem Ipsum Dolor Sit Amet

Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

[Getting Started](getting-started/installation) · [Architecture](architecture) · [IPC Reference](ipc-reference)

## Quis Nostrud Exercitation

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

```typescript
const lorem = async (ipsum: string): Promise<string> => {
  const result = await fetch(`/api/dolor?q=${encodeURIComponent(ipsum)}`);
  if (!result.ok) throw new Error(`Sit amet: ${result.status}`);
  return result.json();
};
```

## Sed Ut Perspiciatis Unde

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

### Neque Porro Quisquam

Ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.

```bash
npm install lorem-ipsum --save-dev
npm run dolor:sit
npm run amet -- --force
```

### At Vero Eos et Accusamus

Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.

## Temporibus Autem Quibusdam

Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.

See also [Features](features) · [Development](development) · [Report an issue](https://github.com/enisz/bitbutler/issues)
