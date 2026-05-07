---
title: 'Configuration'
order: 2
---

# Quasi Architecto Beatae

Vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque.

## Porro Quisquam Est Qui

Dolorem ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco.

```json
{
  "lorem": {
    "host": "192.168.1.42",
    "port": 8080,
    "username": "ipsum",
    "password": "••••••••",
    "tls": false
  },
  "dolor": {
    "theme": "dark",
    "language": "en-US",
    "pollingInterval": 2000,
    "notifications": true
  }
}
```

### Laboris Nisi Ut Aliquip

Ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa.

```typescript
const config: LoremConfig = {
  host: process.env['LOREM_HOST'] ?? 'localhost',
  port: Number(process.env['LOREM_PORT'] ?? 8080),
  credentials: {
    username: process.env['LOREM_USER'] ?? '',
    password: process.env['LOREM_PASS'] ?? '',
  },
  options: {
    timeout: 5_000,
    retries: 3,
    backoff: 'exponential',
  },
};
```

### Qui Officia Deserunt

Mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis.

## Et Quasi Architecto Beatae

Vitae dicta sunt explicabo. See [First Steps](first-steps) for what to do next · [IPC Reference](../ipc-reference) for advanced integration · [Home](../index) to go back.

### Similique Sunt In Culpa

Qui officia deserunt mollitia animi id est laborum et dolorum fuga et harum quidem rerum facilis est et expedita distinctio nam libero tempore cum soluta nobis est eligendi optio cumque.

---

Continue to [First Steps](first-steps) · Back to [Installation](installation)
