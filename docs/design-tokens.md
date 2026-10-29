# TableMate design tokens

Generated from `src/index.css` (the single source). Use these names in code: `bg-background`, `text-muted-foreground`, `border-border`, `var(--tomato)`. Never hard-code a colour. Contrast ratios are computed from the values below; WCAG AA needs 4.5 for body text and 3 for large text and icons.

Brand rule: `--tomato` is for brand art (the chef, the wordmark); `--primary` is the contrast-safe tomato for buttons, links and text on tints.

## Brand

| Token | Light | Dark |
|---|---|---|
| `--tomato` | `#d34f2f` | same as light |
| `--chocolate` | `#34251d` | same as light |
| `--cream` | `#fbf8f0` | same as light |
| `--primary` | `#b83f26` | `#e5603e` |
| `--primary-2` | `#ec7a3a` | `#f39158` |

## Surfaces

| Token | Light | Dark |
|---|---|---|
| `--background` | `#fbf8f0` | `#0b0a09` |
| `--card` | `#fffdf8` | `#141211` |
| `--popover` | `#fffdf8` | `#1a1816` |
| `--secondary` | `#f3ece0` | `#1e1b19` |
| `--muted` | `#f3ece0` | `#1a1816` |
| `--accent` | `#fbe6dc` | `#2a1711` |
| `--border` | `#e9dfcf` | white at 8% |
| `--input` | `#e2d6c3` | white at 13% |
| `--hero` | `#34251d` | `#181513` |

## Text

| Token | Light | Dark |
|---|---|---|
| `--foreground` | `#34251d` | `#f3eee8` |
| `--muted-foreground` | `#7a6658` | `#a69d95` |
| `--card-foreground` | `#34251d` | `#f3eee8` |
| `--primary-foreground` | `#fffaf2` | `#0b0a09` |
| `--accent-foreground` | `#8f2f17` | `#ffcfbd` |
| `--hero-foreground` | `#fbf3e8` | `#f3eee8` |

## State

| Token | Light | Dark |
|---|---|---|
| `--good` | `#23744e` | `#5fbf8f` |
| `--warn` | `#86560b` | `#e7a94a` |
| `--destructive` | `#b42318` | `#f0715c` |
| `--kitchen` | `#8a590c` | `#d8a24c` |
| `--kitchen-mark` | `#a8690c` | `#b87a14` |
| `--floor-mark` | `#d34f2f` | `#e5603e` |

## Contrast of the pairs that matter

| Text on surface | Light | Dark |
|---|---|---|
| `foreground` on `background` | 13.9 | 17.1 |
| `muted-foreground` on `background` | 5.1 | 7.4 |
| `muted-foreground` on `card` | 5.3 | 7.0 |
| `primary` on `background` | 5.2 | 5.7 |
| `primary-foreground` on `primary` | 5.4 | 5.7 |
| `accent-foreground` on `accent` | 6.7 | 12.1 |
| `good` on `background` | 5.4 | 8.8 |
| `warn` on `background` | 5.9 | 9.6 |
| `kitchen` on `background` | 5.6 | 8.7 |
| `destructive` on `background` | 6.2 | 6.8 |

Tinted chips (`bg-primary/12 text-primary` and similar) sit near 4.5 in light mode; on a muted surface use `text-accent-foreground` instead. When you add a colour pair, check its contrast before shipping.

## Type

- **Outfit** (variable) for everything: display headlines at weight 600 with tight tracking (-0.025 to -0.035em), body at 400–500.
- The tagline is the one place letter-spaced capitals are used (`.tagline`).

## Shape, space and motion

- Radius: `--radius` is 1rem; cards use 1–1.5rem, pills are fully round, the phone frame is 2.6rem.
- Touch: controls are at least 44 px high on touch screens (`pointer-coarse:` variants in the Button, Input and Select components).
- Motion: arrivals ease out (`cubic-bezier(0.19, 1, 0.22, 1)`), movement across the screen eases in and out; nothing pops in from zero; everything stops with **Animations off** or when the device asks for reduced motion.
