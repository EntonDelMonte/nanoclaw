---
name: landing-page-architecture
description: Production-grade landing page structure for ANY industry — products, services, agencies, portfolios, events, courses. Universal conversion patterns, flexible section architecture, SEO, and accessibility.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Landing Page Architecture

Build landing pages that load fast, rank well, and convert visitors. Applicable to any industry: **products, services, agencies, portfolios, events, courses, memberships.**

> Related skills: `www-impeccable/Design-System/Animation-UX` (Framer Motion, GSAP scroll reveals), `www-impeccable/Performance/Core-Web-Vitals` (LCP, CLS, INP)

---

## Section Order (Universal Conversion Architecture)

Choose the **5-7 sections** that best fit your offering:

```
1. Navigation    — Logo + key links + primary CTA
2. Hero          — Headline + subheadline + CTA + social proof signal
3. Context       — What it is (product/service/event/course)
4. Value         — Key benefits or outcomes (3-4 items)
5. Process       — How it works / what to expect
6. Proof         — Testimonials / results / social proof
7. Details       — Features / curriculum / itinerary / scope
8. Pricing       — Cost / investment tiers / packages
9. Guarantee     — Risk reversal / satisfaction guarantee
10. FAQ          — Objections and questions
11. Final CTA    — Repeat value proposition + low-friction action
12. Footer       — Links, legal, secondary navigation
```

### Section Selection by Type

| Offering Type | Recommended Sections |
|---------------|----------------------|
| Product | Nav, Hero, Context, Value, Process, Details, Proof, Pricing, FAQ, Final CTA |
| Service | Nav, Hero, Value, Process, Proof, Details, Pricing, Guarantee, FAQ, Final CTA |
| Agency | Nav, Hero, Proof (logos), Value, Process, Portfolio, Proof (case studies), Pricing/CTA, FAQ |
| Portfolio | Nav, Hero, Work, Process, Services, Proof, Contact CTA |
| Event | Nav, Hero, Context, Value, Speakers/Agenda, Details, Pricing, FAQ, Final CTA |
| Course | Nav, Hero, Context, Value, Curriculum, Proof, Pricing, Guarantee, FAQ, Final CTA |
| Membership | Nav, Hero, Value, What's Included, Community Proof, Pricing, FAQ, Final CTA |

---

## Hero Section — Above the Fold Rules

**The 5-Second Test**: Visitors must understand what you offer and who it's for within 5 seconds.

### Hero Structure
```
[Headline: The primary outcome or transformation — max 10 words]
[Subheadline: Who it's for + what they get — max 25 words]
[Primary CTA button: Low friction, action-oriented]
[Secondary action: Link to see more / watch video / view samples]
[Social proof element: Trust signal below fold or beside CTA]
```

### Headline Patterns by Industry

- **Products**: "[Outcome] without [common pain point]" — *Hand-brewed coffee without the learning curve*
- **Services**: "[Service] that [result]" — *Web design that actually books clients*
- **Agencies**: "[Adjective] [result] for [audience]" — *Conversion-focused design for SaaS startups*
- **Courses**: "Learn [skill] in [timeframe]" — *Learn UI design in 8 weeks*
- **Events**: "[Event type] for [audience] [date]" — *The eCommerce summit for DTC brands, June 15*
- **Portfolios**: "I help [audience] achieve [outcome]" — *I help brands stand out through bold design*

### Performance Requirements
- LCP target: hero image/heading must paint within 2.5s
- Preload hero image with `fetchpriority="high"`
- Never lazy-load above-fold content

```html
<!-- Hero image preload — always in <head> -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">

<!-- Hero image — never lazy-load the LCP element -->
<img src="/hero.webp" alt="Descriptive text" width="1200" height="630" fetchpriority="high">
```

---

## CTA Hierarchy

### CTA Levels

| Level | Usage | Style | Examples |
|-------|-------|-------|----------|
| **Primary** | Main conversion (1 per section) | Filled, high contrast color | "Get [outcome]", "Start [transformation]", "Book [consultation]", "Reserve spot" |
| **Secondary** | Lower-friction exploratory action | Outlined/subtle | "See examples", "Watch demo", "View portfolio", "Browse curriculum" |
| **Tertiary** | Navigation/info | Text link | "Learn more", "Read full story", "Check dates" |

### Industry-Specific CTA Copy

| Industry | Primary CTA | Secondary CTA |
|----------|-------------|---------------|
| **Product** | Buy now, Add to cart, Get yours | See features, View gallery, Read reviews |
| **Service** | Book consultation, Get quote, Let's talk | See process, View case studies, FAQs |
| **Course** | Enroll now, Start learning, Get instant access | Preview curriculum, See what you'll build |
| **Event** | Reserve spot, Get tickets, Register | View agenda, See speakers, Location info |
| **Agency** | Start project, Book call, Get proposal | View portfolio, See pricing, Services |
| **Portfolio** | Work together, Hire me, Start project | View work, Download resume, Services |

### CTA Placement Rules
- One primary CTA per viewport
- Repeat primary CTA after proof/value sections
- Match button copy to the specific page goal
- Use verb + outcome (not just "Submit" or "Click here")

---

## Social Proof Placement

### Social Proof Types by Location

| Page Location | Social Proof Type | Examples |
|---------------|-------------------|----------|
| **Hero/Below fold** | Trust indicators | Client logos, "Featured in", Star rating |
| **Between sections** | Result metrics | "200+ projects delivered", "10,000+ students" |
| **After value pitch** | Testimonials | Customer quotes with photos/results |
| **After details** | Case studies | Before/after, specific outcomes, timeframes |
| **Near CTA** | Risk reducers | Guarantee badges, review counts, "Join 500+ others" |
| **Footer area** | Trust signals | Awards, certifications, security badges |

### Universal Social Proof Strategies

**For New/Low-Recognition Brands**:
- Show actual work/results (portfolio samples)
- Quote specific transformations
- Include photos of real people
- Demo videos showing the product/service in action

**For Established Brands**:
- Client/customer logos
- Review aggregators (Trustpilot, G2, Google Reviews)
- User counts and metrics
- Media mentions and awards

**For Services/Consulting**:
- Before/after metrics
- Specific ROI or time savings
- Video testimonials
- Case studies with full narrative arc

**For Products**:
- Review count and average rating
- User-generated content
- "Most popular" indicators
- Unboxing/demo videos

**For Courses/Events**:
- Alumni outcomes and examples
- "X people registered this week"
- Speaker/performer credibility
- Community size/activity

### Schema Markup (Universal)

```html
<!-- Schema: Product -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "ProductName",
  "description": "...",
  "brand": { "@type": "Brand", "name": "BrandName" },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "420"
  },
  "offers": {
    "@type": "Offer",
    "price": "99.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

---

## SEO Fundamentals

### Meta Tags (Every Page)

```html
<title>Primary Keyword — Brand Name</title>
<meta name="description" content="Compelling 150-160 char description with keyword and CTA.">
<link rel="canonical" href="https://example.com/">
```

### Industry-Specific Meta Examples

| Industry | Title Template | Description Pattern |
|----------|---------------|---------------------|
| Product | [Product] — [Key Benefit] | "Shop [product] for [benefit]. [Social proof]. Free shipping over $X." |
| Service | [Service] in [Location] — [Outcome] | "[Service] that [result]. Book your consultation. [Timeframe] results guaranteed." |
| Course | [Course Name] — Learn [Skill] | "Master [skill] in [timeframe]. [Number] students enrolled. Start learning today." |
| Event | [Event] — [Date] — [Location] | "Join [number] [audience] for [event type]. Tickets selling fast. Register now." |
| Agency | [Agency Type] Agency — [Specialty] | "[Result]-focused [service] for [audience]. See our work. Book a free consultation." |
| Portfolio | [Name] — [Role] — [Specialty] | "I help [audience] achieve [outcome] through [service]. View my work." |

### Open Graph (Social Sharing)

```html
<meta property="og:title" content="Primary Keyword — Brand Name">
<meta property="og:description" content="Short, punchy. Same as meta description.">
<meta property="og:image" content="https://example.com/og-image.png">
<!-- OG image: 1200×630px (universal standard) -->
<meta property="og:url" content="https://example.com/">
<meta property="og:type" content="website">
<!-- Options: website, product, event, profile, course -->

<!-- Twitter/X card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://example.com/og-image.png">
```

### Structured Data by Type

```json
// Course
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Course Name",
  "description": "...",
  "provider": { "@type": "Organization", "name": "Provider" },
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "online",
    "instructor": { "@type": "Person", "name": "Instructor Name" }
  }
}

// Event
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Event Name",
  "startDate": "2025-06-15T09:00",
  "endDate": "2025-06-15T17:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Venue Name",
    "address": { "@type": "PostalAddress", "streetAddress": "..." }
  },
  "offers": {
    "@type": "Offer",
    "price": "299",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "validFrom": "2025-01-01"
  }
}

// LocalBusiness / Service
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Business Name",
  "description": "...",
  "telephone": "+1-xxx-xxx-xxxx",
  "address": { "@type": "PostalAddress", "..." },
  "geo": { "@type": "GeoCoordinates", "latitude": "...", "longitude": "..." },
  "priceRange": "$$",
  "openingHours": "Mo-Fr 09:00-17:00"
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

---

## Image Optimization

```html
<!-- Format: prefer WebP/AVIF, fallback JPEG -->
<picture>
  <source srcset="/hero.avif" type="image/avif">
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="Descriptive text" width="1200" height="630" loading="eager">
</picture>

<!-- Below-fold images: lazy load -->
<img src="/feature.webp" alt="..." width="600" height="400" loading="lazy">
```

**Next.js**: Always use `<Image>` component — handles WebP conversion, lazy loading, and dimension reservation automatically.

---

## Pricing Section Architecture

### Product Pricing

```
[Product Image]          [Product Name]
[Starting at $XX]       [Variants/Options selector]
[Reviews ★★★★★]         [Quantity selector]
                         [Buy button — primary]
                         [Shipping estimate]
                         [Return policy link]
```

### Service Pricing

```
Package: Starter         Package: Professional     Package: Custom
$X/month                 $Y/month                  Custom
───────                  ─────────                 ───────
Best for: [use case]     Best for: [use case]      Best for: [use case]

• Feature                • Everything in Starter   • Everything in Pro
• Feature                • Feature                 • Feature
• Feature                • Feature                 • Feature
                         • Feature                 • Dedicated support
                                                   • Custom SLA

[Get started]            [Get started]             [Contact sales]
```

### Course/Event Pricing

```
Single Payment           Payment Plan              VIP/Elite
$XXX                     $XX × 4                   $XXXX
───────                  ──────                    ───────
Full access              Full access               Everything in Full
Lifetime updates         Lifetime updates          Bonus: [exclusive items]
Community access         Community access          1:1 sessions
                         Same total price          White glove onboarding

[Enroll now]             [Choose plan]             [Apply now]
```

### Pricing Page Rules
- Lead with the recommended option (visual emphasis)
- Show total cost, not just "per month"
- For courses: show payment protection/guarantee
- For services: include " typical project timeline"
- Always place FAQ directly below pricing

---

## Performance Checklist

- [ ] Hero image preloaded with `fetchpriority="high"`
- [ ] All images have explicit `width` and `height` (prevents CLS)
- [ ] Below-fold images use `loading="lazy"`
- [ ] No render-blocking scripts in `<head>` (use `defer`/`async`)
- [ ] Fonts use `font-display: swap` or `optional`
- [ ] Critical CSS inlined
- [ ] OG image generated (1200×630px)
- [ ] Structured data validated at schema.org/validator
- [ ] Lighthouse score ≥ 90 Performance, ≥ 90 SEO before launch
- [ ] Mobile: all CTAs thumb-reachable
- [ ] Mobile: forms work with native keyboards

---

## Advanced: Conversion Optimization

### The 3-Point Landing Page Test

Before publishing, verify:

1. **Clarity**: Can a first-time visitor explain what you offer in one sentence?
2. **Motivation**: Is the "after state" (result) clearly painted?
3. **Friction**: Are objections addressed before the CTA?

### Persuasion Elements Checklist

- [ ] Specific outcomes/results (not just features)
- [ ] Process transparency (what happens next)
- [ ] Risk reversal (guarantee, refund policy, trial)
- [ ] Urgency based on real scarcity (if applicable)
- [ ] Clear differentiation from alternatives
- [ ] Human elements (faces, names, stories)

### Trust Signals by Industry

| Industry | Top Trust Factors |
|----------|-------------------|
| Product | Reviews, return policy, secure checkout, transparent pricing |
| Service | Portfolio, process clarity, contract terms, insurance |
| Course | Instructor credibility, student outcomes, refund policy |
| Event | Refund policy, venue details, organizer credibility |
| Agency | Case studies, client logos, clear proposal process |

---

Last updated: 2026-04-04 | Applicable across: Technology, Consumer Products, Professional Services, Education, Creative Services, Events, Non-profits
