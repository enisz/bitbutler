---
title: 'Lorem Ipsum'
order: 1
slug: 'lorem-ipsum'
---

# De Finibus Bonorum et Malorum

Neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci velit sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

![Lorem Ipsum](../../../public/images/Lorem-Ipsum-alternatives-768x492.png)

## Cicero XLV BC

Ut enim ad minima veniam quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.

```python
# Quam nihil molestiae consequatur
import cicero

def de_finibus(bonorum: str, malorum: int = 45) -> dict:
    """Totam rem aperiam section 1.10.32."""
    lorem = cicero.parse(bonorum, year=-malorum)
    ipsum = {
        "source": lorem.origin,
        "year": lorem.year_bc,
        "lines": lorem.extract(section="1.10.32"),
    }
    return ipsum


result = de_finibus("Lorem ipsum dolor sit amet", malorum=45)
print(result["lines"])
```

### Sectio Prima

Accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas.

### Sectio Altera

Sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur.

## Richard McClintock MCMXCIV

Adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

```typescript
// Hampden-Sydney College Virginia
const consectetur = [
  'Lorem ipsum dolor sit amet',
  'Consectetur adipiscing elit',
  'Sed do eiusmod tempor incididunt',
  'Ut labore et dolore magna aliqua',
] as const;

type LoremLine = (typeof consectetur)[number];

function findOrigin(line: LoremLine): string {
  const index = consectetur.indexOf(line);
  return `Section 1.10.${32 + index}`;
}

console.log(findOrigin('Lorem ipsum dolor sit amet'));
// → "Section 1.10.32"
```

### Iste Natus Error

Sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis. See [Home](../index) · [Features](../features) · External: [lipsum.com](https://www.lipsum.com).

## Sectio Ultima

Nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus omnis voluptas assumenda est omnis dolor repellendus temporibus.

---

Classical Latin · [Wikipedia](https://en.wikipedia.org/wiki/Lorem_ipsum) · [Home](../index)
