# Design Tokens Reference

Starter token sets, color palettes, and typography scales for the `ui-design-system` skill.

## Starter Token Sets

### Neutral SaaS (Default)

A clean, professional palette suitable for dashboards and B2B applications.

```css
:root {
  /* Background & Foreground */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;

  /* Brand */
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;

  /* Secondary */
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  /* Muted */
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;

  /* Accent */
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;

  /* Destructive */
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;

  /* Borders & Inputs */
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 221 83% 53%;

  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: 217 33% 17%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 33% 17%;
  --input: 217 33% 17%;
  --ring: 224 76% 48%;
}
```

### Warm Consumer

A friendlier palette for consumer-facing products.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 20 14% 4%;
  --primary: 24 95% 53%;
  --primary-foreground: 60 9% 98%;
  --secondary: 60 5% 96%;
  --secondary-foreground: 24 10% 10%;
  --muted: 60 5% 96%;
  --muted-foreground: 25 5% 45%;
  --accent: 60 5% 96%;
  --accent-foreground: 24 10% 10%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 60 9% 98%;
  --border: 20 6% 90%;
  --input: 20 6% 90%;
  --ring: 24 95% 53%;
  --radius: 0.75rem;
}

.dark {
  --background: 20 14% 4%;
  --foreground: 60 9% 98%;
  --primary: 20 90% 48%;
  --primary-foreground: 60 9% 98%;
  --secondary: 12 6% 15%;
  --secondary-foreground: 60 9% 98%;
  --muted: 12 6% 15%;
  --muted-foreground: 24 5% 64%;
  --accent: 12 6% 15%;
  --accent-foreground: 60 9% 98%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 60 9% 98%;
  --border: 12 6% 15%;
  --input: 12 6% 15%;
  --ring: 20 90% 48%;
}
```

### Minimal Dark-First

A dark-first palette for developer tools and technical products.

```css
:root {
  --background: 0 0% 4%;
  --foreground: 0 0% 95%;
  --primary: 142 71% 45%;
  --primary-foreground: 144 80% 10%;
  --secondary: 0 0% 15%;
  --secondary-foreground: 0 0% 95%;
  --muted: 0 0% 15%;
  --muted-foreground: 0 0% 64%;
  --accent: 0 0% 15%;
  --accent-foreground: 0 0% 95%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 0 0% 95%;
  --border: 0 0% 15%;
  --input: 0 0% 15%;
  --ring: 142 71% 45%;
  --radius: 0.375rem;
}
```

## Color Palette Guide

### Semantic Token Mapping

| Token | Purpose | Example Usage |
|-------|---------|---------------|
| `background` | Page and card backgrounds | `bg-background` |
| `foreground` | Primary text color | `text-foreground` |
| `primary` | Brand actions (buttons, links) | `bg-primary text-primary-foreground` |
| `secondary` | Secondary actions, tags | `bg-secondary text-secondary-foreground` |
| `muted` | Subtle backgrounds, disabled states | `bg-muted text-muted-foreground` |
| `accent` | Hover states, highlights | `bg-accent text-accent-foreground` |
| `destructive` | Delete, error, danger | `bg-destructive text-destructive-foreground` |
| `border` | Borders, dividers | `border-border` |
| `input` | Form input borders | `border-input` |
| `ring` | Focus rings | `ring-ring` |

### Adding Custom Semantic Colors

When a project needs additional semantic colors (e.g., success, warning, info):

```css
:root {
  --success: 142 76% 36%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 0%;
  --info: 199 89% 48%;
  --info-foreground: 0 0% 100%;
}
```

Add to Tailwind config:

```ts
colors: {
  success: {
    DEFAULT: "hsl(var(--success))",
    foreground: "hsl(var(--success-foreground))",
  },
  warning: {
    DEFAULT: "hsl(var(--warning))",
    foreground: "hsl(var(--warning-foreground))",
  },
  info: {
    DEFAULT: "hsl(var(--info))",
    foreground: "hsl(var(--info-foreground))",
  },
}
```

### Hex to HSL Conversion

When given brand hex values, convert to HSL for token integration:

| Hex | HSL | Token |
|-----|-----|-------|
| `#2563EB` | `221 83% 53%` | `--primary` |
| `#DC2626` | `0 84% 60%` | `--destructive` |
| `#16A34A` | `142 76% 36%` | `--success` |
| `#F59E0B` | `38 92% 50%` | `--warning` |

## Typography Scales

### Default Scale (Inter)

```ts
// tailwind.config.ts
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
},
```

| Element | Classes | Rendered |
|---------|---------|----------|
| Page title | `text-3xl font-bold tracking-tight` | 30px, bold |
| Section heading | `text-2xl font-semibold tracking-tight` | 24px, semibold |
| Card heading | `text-lg font-medium` | 18px, medium |
| Body | `text-base` | 16px, normal |
| Label | `text-sm font-medium` | 14px, medium |
| Caption | `text-xs text-muted-foreground` | 12px, muted |

### Monospace Scale (for code/developer tools)

```ts
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "Fira Code", "monospace"],
},
```

Use `font-mono` for code blocks, terminal output, and data tables with numeric alignment.

## Spacing Quick Reference

```
4px  = p-1, gap-1, m-1       (icon padding, tight inline gaps)
8px  = p-2, gap-2, m-2       (compact spacing)
12px = p-3, gap-3, m-3       (input padding)
16px = p-4, gap-4, m-4       (standard component gap)
24px = p-6, gap-6, m-6       (card padding, section gap)
32px = p-8, gap-8, m-8       (section padding)
48px = p-12, gap-12, m-12    (page section vertical spacing)
64px = p-16, gap-16, m-16    (major layout sections)
```

### Common Component Spacing

| Component | Padding | Internal Gap | Margin |
|-----------|---------|--------------|--------|
| Button | `px-4 py-2` | `gap-2` (icon + text) | — |
| Card | `p-6` | `gap-4` | — |
| Form field | — | `gap-2` (label + input) | `space-y-4` between fields |
| Modal | `p-6` | `gap-4` | — |
| Page section | `py-12` | `gap-6` | — |
| Table cell | `px-4 py-3` | — | — |
| Navbar | `px-4 sm:px-6 lg:px-8` | `gap-4` | `h-16` |
