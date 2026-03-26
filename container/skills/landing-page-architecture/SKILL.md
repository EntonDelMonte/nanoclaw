---
name: landing-page-architecture
description: Production-grade landing page structure — section architecture, conversion patterns, SEO (meta/OG/structured data), image optimisation, and accessibility. Use for building or auditing SaaS/product landing pages.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Landing Page Architecture

Build landing pages that load fast, rank well, and convert visitors.

> Related skills: `www-impeccable/Design-System/Animation-UX` (Framer Motion, GSAP scroll reveals), `www-impeccable/Performance/Core-Web-Vitals` (LCP, CLS, INP)

---

## Section Order (Proven Conversion Architecture)

```
1. Nav          — logo + 2-3 links + single CTA button
2. Hero         — headline + subheadline + primary CTA + social proof signal
3. Problem      — 3 pain points (before state)
4. Solution     — how it works, 3 steps (after state)
5. Features     — 3-6 feature cards with icons
6. Social Proof — testimonials / logos / metrics
7. Pricing      — free/paid tiers, clear CTA per tier
8. FAQ          — 5-7 questions targeting objections
9. Final CTA    — repeat headline + email capture or signup button
10. Footer      — links, legal, social
```

### Hero Section — Above the Fold Rules
- Headline: outcome-focused, max 8 words, no jargon
- Subheadline: who it's for + what they get, max 20 words
- Primary CTA: single action ("Start free" / "Get started") — never "Learn more"
- Social proof signal: "1,200 teams already using" or logo strip
- LCP target: hero image/heading must paint within 2.5s (preload hero image)

```html
<!-- Hero image preload — always in <head> -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">

<!-- Hero image — never lazy-load the LCP element -->
<img src="/hero.webp" alt="..." width="1200" height="630" fetchpriority="high">
```

---

## CTA Hierarchy

| Level | Usage | Style |
|-------|-------|-------|
| Primary | Main conversion action (1 per section) | Filled, high contrast |
| Secondary | Lower-friction action ("See demo") | Outlined |
| Ghost | Navigation / tertiary | Text link |

Rules:
- One primary CTA per viewport
- CTA text = verb + outcome ("Start building" not "Submit")
- Repeat primary CTA in hero, after features, after pricing, in final CTA

---

## Social Proof Placement

| Type | Best Location |
|------|--------------|
| Logo strip (trusted by) | Below hero, immediately |
| Metrics ("10k users") | Hero or features section |
| Testimonial quotes | After features, before pricing |
| Case study | Below pricing for high-intent visitors |
| Review count + rating | Near primary CTA |

```html
<!-- Schema: AggregateRating -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ProductName",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "420"
  }
}
</script>
```

---

## SEO Fundamentals

### Meta Tags (every page)
```html
<title>Primary Keyword — Brand Name</title>
<meta name="description" content="One sentence, 150-160 chars, includes keyword and CTA.">
<link rel="canonical" href="https://example.com/">
```

### Open Graph (social sharing)
```html
<meta property="og:title" content="Primary Keyword — Brand Name">
<meta property="og:description" content="Short, punchy. Same as meta description.">
<meta property="og:image" content="https://example.com/og-image.png">
<!-- OG image: 1200×630px -->
<meta property="og:url" content="https://example.com/">
<meta property="og:type" content="website">

<!-- Twitter/X card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://example.com/og-image.png">
```

### Structured Data (SoftwareApplication)
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ProductName",
  "description": "...",
  "url": "https://example.com",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free tier available"
  }
}
```

### Sitemap & Robots
```
/public/sitemap.xml — submit to Google Search Console
/public/robots.txt:
  User-agent: *
  Allow: /
  Sitemap: https://example.com/sitemap.xml
```

For Next.js, use `next-sitemap` package:
```bash
npm i next-sitemap
# next-sitemap.config.js:
module.exports = { siteUrl: 'https://example.com', generateRobotsTxt: true }
# package.json postbuild: "next-sitemap"
```

---

## Image Optimisation

```html
<!-- Format: prefer WebP/AVIF, fallback JPEG -->
<picture>
  <source srcset="/hero.avif" type="image/avif">
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="..." width="1200" height="630" loading="eager">
</picture>

<!-- Below-fold images: lazy load -->
<img src="/feature.webp" alt="..." width="600" height="400" loading="lazy">
```

Next.js: always use `<Image>` component — handles WebP conversion, lazy loading, and dimension reservation automatically.

---

## Pricing Section Architecture

```
Free tier    | Pro tier         | Enterprise
$0/mo        | $29/mo           | Custom
----------   | -----------      | -----------
Feature A    | Everything in Free| Everything in Pro
Feature B    | Feature C        | Feature D
Feature E    | Feature F        | Custom SLA
             |                  |
[Start free] | [Start trial]    | [Contact sales]
```

Rules:
- Highlight the recommended tier (visual badge: "Most popular")
- Monthly/annual toggle — show savings percentage
- Free trial > freemium for SaaS conversion
- Place FAQ directly below pricing to handle objections at decision point

---

## Performance Checklist

- [ ] Hero image preloaded with `fetchpriority="high"`
- [ ] All images have explicit `width` and `height` (prevents CLS)
- [ ] Below-fold images use `loading="lazy"`
- [ ] No render-blocking scripts in `<head>` (use `defer`/`async`)
- [ ] Fonts use `font-display: swap` or `optional`
- [ ] Critical CSS inlined or in `<style>` block
- [ ] OG image generated (1200×630px)
- [ ] Structured data validated at schema.org/validator
- [ ] Lighthouse score ≥ 90 Performance, ≥ 90 SEO before launch
