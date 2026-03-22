---
name: site-to-skill
description: Given a URL, crawl the site's key pages (via sitemap or common page types), extract design patterns, content structure, and front-end conventions, then condense everything into a reusable skill file saved to the Obsidian vault under MnemClaw/Skill Repo/web/. Use whenever the user sends a URL to analyse a site.
allowed-tools: Bash(agent-browser:*), agent-browser, Write, Bash
---

# Site-to-Skill

Crawls a website, extracts its front-end DNA (design tokens, layout patterns, component library, content structure, copy conventions), and writes a condensed reusable skill reference into the Obsidian vault.

---

## Workflow

### 1. Discover pages via sitemap

```bash
DOMAIN=$(echo "$URL" | python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.stdin.read().strip()); print(u.scheme+'://'+u.netloc)")

# Try common sitemap locations
for path in /sitemap.xml /sitemap_index.xml /sitemap /sitemap.txt /robots.txt; do
  agent-browser open "$DOMAIN$path"
  agent-browser get text body   # check if it contains URLs or sitemap data
done
```

From `robots.txt`, look for `Sitemap:` directives.
From `sitemap.xml`, extract `<loc>` URLs.
From `sitemap_index.xml`, follow child sitemaps and pick up to 3 most relevant ones.

### 2. Identify and prioritise page types

From the sitemap URL list (or by navigating the site), identify these page types — **crawl at most 8 pages total**:

| Priority | Page Type | What to look for |
|---|---|---|
| 1 | **Homepage** | Hero layout, headline patterns, primary CTA, nav structure |
| 2 | **Features / Product** | Card components, icon usage, benefit copy patterns |
| 3 | **Pricing** | Table/card layout, tier naming, CTA copy |
| 4 | **About / Story** | Brand voice, tone, team layout |
| 5 | **Blog / Docs index** | Grid/list patterns, filtering, typography |
| 6 | **Single article/doc** | Reading typography, sidebar, TOC pattern |
| 7 | **Contact / CTA page** | Form patterns, conversion copy |
| 8 | **Footer** | Link structure, legal, social links |

If a page type doesn't exist, skip it.

### 3. Crawl each page with agent-browser

For each target page:

```bash
agent-browser open "$PAGE_URL"
agent-browser wait --load networkidle
agent-browser screenshot "/tmp/screenshots/${PAGE_SLUG}.png"

# Extract structural data
agent-browser get text "h1"          # Primary headline
agent-browser get text "nav"         # Navigation items
agent-browser snapshot -c            # Compact layout tree
agent-browser eval "
  const styles = window.getComputedStyle(document.body);
  const buttons = [...document.querySelectorAll('a[class*=btn],button')].slice(0,3);
  const fonts = [...new Set([...document.querySelectorAll('*')].map(e=>window.getComputedStyle(e).fontFamily).filter(Boolean))].slice(0,5);
  const colors = [...new Set([...document.querySelectorAll('*')].flatMap(e=>[
    window.getComputedStyle(e).color,
    window.getComputedStyle(e).backgroundColor
  ]).filter(c=>c && c!=='rgba(0, 0, 0, 0)' && c!=='transparent'))].slice(0,12);
  JSON.stringify({fonts, colors, buttonTexts: buttons.map(b=>b.textContent.trim())})
"
```

### 4. Extract meta + branding from homepage

```bash
agent-browser open "$DOMAIN"
agent-browser eval "
  JSON.stringify({
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    ogImage: document.querySelector('meta[property=\"og:image\"]')?.content,
    themeColor: document.querySelector('meta[name=theme-color]')?.content,
    h1: document.querySelector('h1')?.textContent?.trim(),
    navLinks: [...document.querySelectorAll('nav a')].map(a=>a.textContent.trim()).filter(Boolean).slice(0,12)
  })
"
```

### 5. Synthesise into a skill file

After crawling all pages, write a single Markdown file:

**Output path:** `/workspace/extra/obsidian/MnemClaw/Skill Repo/web/<domain-slug>.md`

Example: `stripe-com.md`, `linear-app.md`, `vercel-com.md` — placed directly in the `web/` folder, no subfolders.

---

## Output Format

```markdown
---
title: "Site Reference: <Site Name>"
domain: "<domain>"
url: "<homepage URL>"
crawled: <YYYY-MM-DD>
pages_analysed: <N>
maturity: reference
status: Active design reference
tags:
  - web-reference
  - front-end
  - design-reference
  - <industry tag e.g. saas, e-commerce, agency>
description: "Design and content reference for <Site Name> — <one line on what the site does>."
---

# Site Reference: <Site Name>

> <Domain> · Crawled <date> · <N> pages analysed

<One paragraph describing the site, its purpose, target audience, and overall design language.>

---

## Brand & Identity

| | |
|---|---|
| **Primary colour** | `#hex` (rgb(...)) |
| **Background** | `#hex` |
| **Accent / CTA colour** | `#hex` |
| **Font stack** | `"Font Name", fallback` |
| **Heading font** | `"Font Name"` |
| **Border radius** | e.g. `8px` / `pill` / `none` |
| **Shadow style** | e.g. `soft`, `flat`, `elevation` |

---

## Navigation

- Structure: [top nav / sidebar / hamburger]
- Primary items: [list]
- CTA in nav: [text + style]
- Mobile behaviour: [note]

---

## Page Types & Layout Patterns

### Homepage
- Hero: [layout description — full-bleed / split / centered]
- Headline: "[example H1 text]"
- CTA: "[button text]" — [position, colour, size]
- Below fold: [what sections follow]

### [Other page types found]
...

---

## Component Patterns

### Buttons
- Primary: [colour, border-radius, text style, hover]
- Secondary: [ghost / outline / text]
- CTA copy style: [action verbs used, e.g. "Get started", "Try free"]

### Cards
- Used for: [features / pricing / blog / team]
- Style: [border / shadow / fill]
- Hover effect: [lift / highlight / none]

### Typography
- H1: [size / weight / line-height]
- Body: [size / weight / colour]
- Accent text: [colour, usage]

### Forms
- Input style: [bordered / underline / filled]
- Label position: [above / floating / placeholder]
- Submit CTA: [text]

---

## Content & Copy Patterns

- **Tone:** [e.g. confident, friendly, technical, minimal]
- **Headline style:** [e.g. verb-first, benefit-led, question, bold claim]
- **Example headlines:**
  - "[H1 from homepage]"
  - "[H2 from features page]"
- **CTA copy patterns:** "[Start building]", "[Try free]", etc.
- **Social proof:** [testimonials / logos / numbers — placement]

---

## Content Structure by Page

| Page | URL | Key sections |
|---|---|---|
| Homepage | / | Hero, [section names] |
| [Page type] | /path | [sections] |

---

## Technical Observations

- **Framework signals:** [React / Next.js / Nuxt / static — inferred from DOM patterns]
- **CSS approach:** [Tailwind / CSS modules / styled-components / custom]
- **Animation:** [Framer Motion / GSAP / CSS transitions / none]
- **Icon set:** [Heroicons / Lucide / custom SVG]
- **Image strategy:** [lazy load / WebP / CDN]

---

## Usage Notes for Developer

*How to apply these patterns when building something inspired by this site:*

- [Key insight 1 — e.g. "Use generous white space with a single strong accent colour"]
- [Key insight 2 — e.g. "Headlines are always verb-first and benefit-led"]
- [Key insight 3 — e.g. "Cards have a subtle lift on hover, 8px radius, soft shadow"]

---

## JTAG Annotation
Type: Web Design Reference
Scope: <industry / sector of the site>
Maturity: Reference — crawled <N> pages, <date>
Cross-links: <[[related skill repo notes or project notes]]>
Key Components: Brand identity, Navigation, Layout patterns, Component library, Copy conventions, Technical stack
```

---

## Rules

- Crawl maximum **8 pages** — quality over quantity
- Always start with the homepage
- If sitemap is unavailable, use `agent-browser` to navigate from the homepage via the nav
- Screenshots are for your analysis only — do not embed them in the output
- Fill in `[unknown]` for anything you cannot determine — never guess colours or fonts
- Save to `/workspace/extra/obsidian/MnemClaw/Skill Repo/web/<domain-slug>.md` — flat file, no subfolder
- Domain slug: replace dots and slashes with hyphens, e.g. `stripe.com` → `stripe-com.md`
- After saving, send a brief summary message: site name, pages crawled, key design notes
