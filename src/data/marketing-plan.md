# Z-Health Marketing Plan

Canonical marketing strategy + campaign tracker across ALL channels — paid ads, on-site promos, product discounts, email, newsletter, organic/SEO, social, partnerships. When Kade says "marketing plan," this is the doc.

Last updated: 2026-08-21

---

## Status legend

- **ACTIVE** — running right now, hands off unless approved
- **PLANNING** — being built or drafted, not yet live
- **QUEUED** — approved concept, waiting on a trigger (date, dependency, budget)
- **PAUSED** — was live, temporarily off
- **DONE** — completed, kept for reference / learnings
- **IDEA** — raw concept, not yet planned

Every entry below carries one of these at the front of its heading.

---

## Strategy pillars

_(top-level positioning, audience segments, priority channels, KPI targets — fill in)_

- Audience segments:
- Positioning:
- Priority channels:
- North-star metric:
- Budget envelope:

---

## 1. Paid ads

_(Meta, Google, YouTube, retargeting, etc. — creative, spend, audience, LP)_

### 
- Channel:
- Status:
- Spend / cap:
- Creative / LP:
- Notes:

---

## 2. On-site promos

_(hello bars, popups, banners, exit intent, homepage hero swaps)_

### ACTIVE — Hello Bar V3
- Displaying site-wide
- Swap-back planned to EEP "final week" variant — waiting on Tara to name the date
- Swap mechanism: WP-Cron `zh_hello_bar_swap` (RULE 31 in `zh-perf-mu.php`) — set once, fires automatically
- See: [scheduled_popup_swap_workflow](../Users/kadec/.claude/projects/c--Users-kadec-Documents-zhealth-ai/memory/reference_scheduled_popup_swap_workflow.md)

---

## 3. Landing pages / product pages

### ACTIVE — BBFP "Defying Gravity" LP
- URL: `/bbfp-special-offer/` (post 86547) — note: `/brain-based-training-applied-replay/` currently 301s to `/product/bbpg/`
- Status: live; sale ends Aug 31. Offer box tightened 2026-08-25 — dropped "which saves you $424" (duplicated the price) + duplicate "Lifetime access." from CTA note. Earlier Aug tightening also removed "$424" from CTA buttons + changed timer to "Sale Ends In".
- Guardrails: revenue-critical, don't restructure copy without Tara approval

### PLANNING — September Sale LP
- URL: `/september-sale/` (post 75153, currently draft)
- Skeleton: 3 headlines ("Learning has its Rewards!", "September Sale", "Save up to 40%") + 2 short curriculum blurbs (Core + 9S) + CTA buttons. No offer stack / value ladder / lifetime-access panel yet.
- ISSUES TO ADDRESS BEFORE LAUNCH:
  - Typo in Core Curriculum blurb: "35% off a single course, or 40% two or more courses" — missing "off" after "40%"
  - When the offer stack gets built, mirror the tightened BBFP pattern: crossed-out regular price above visible price does the savings math visually; don't add a redundant "saves you $X" line; button-text and CTA-note shouldn't both say "Lifetime access"
- Copy is Doc's — any wording change needs Doc / Tara sign-off (typo excepted)

### PLANNING — NMMM + BBFP Sale LP
- URL: `/nmmm-and-bbfp-sale/` (post 83215, currently draft)
- Built-out shell (~317 chunks): LEVEL UP WITH → What You'll Learn → What's Included → Meet Dr. Cobb → Testimonials → FAQ (x2). No pricing / offer stack yet.
- ISSUES TO ADDRESS BEFORE LAUNCH:
  - Character encoding is corrupted in at least 2 places — em-dashes rendered as `�` in the "Level Up With" text ("basics�you need a system") and Doc's intro ("Dr. Eric Cobb � founder"). Import mangled them; needs a pass to restore Doc's words.
  - FAQ heading "Frequently asked questions" appears twice — intentional if two separate FAQ blocks per course, otherwise consolidate.
- Same offer-stack watch as September Sale when pricing gets added.

### ACTIVE — BBPG product page
- URL: `/product/bbpg/`
- Guardrails: revenue-critical, no new copy without coordination

---

## 4. Product discounts / offers

_(price cuts, bundles, coupons, expiring urgency mechanics, payment plans)_

### 
- Offer:
- Products:
- Discount / mechanic:
- Window (start → end):
- Where it's displayed (LP, popup, email, ads):
- Status:

---

## 5. Email

_(list segments, sequences, one-offs, cadence)_

### Sequences
- 

### One-off blasts

### 
- Segment:
- Subject:
- Send date:
- Status:
- CTA / destination:

---

## 6. Newsletter — Out of the Box (weekly)

- Cadence: weekly
- Voice: Dr. Cobb writes copy (never rewrite his words)
- Ops: Tara sign-off for structural changes
- Content pipeline / editorial calendar: 

---

## 7. Organic / SEO / content

_(blog posts, cluster hubs, on-page SEO fixes, structured data, technical audits)_

### 
- Target keyword / cluster:
- URL:
- Status:

---

## 8. Social / community

_(IG, FB, YouTube, LinkedIn, community groups, podcasts)_

### 
- Channel:
- Cadence:
- Owner:
- Status:

---

## 9. Partnerships / affiliates / practitioner network

_(Master Practitioners directory, joint promos, referral offers)_

### Master Practitioner directory (ongoing)
- Additions via `ex_team` CPT + Team-Press plugin
- Workflow verified 2026-07-27, see [reference_add_master_practitioner](../Users/kadec/.claude/projects/c--Users-kadec-Documents-zhealth-ai/memory/reference_add_master_practitioner.md)

---

## Ideas / backlog

_(dump ideas here — promote into a campaign section when scoped)_

- 

---

## Done / archive

### DONE — BBPG July 14 2026 webinar campaign
- Landing page: `/brain-based-training-applied-replay/` (now evergreen BBFP LP)

---

## Notes on how to use this file

- New initiative? Add it under the right channel section with a status prefix.
- Status change? Update the prefix (ACTIVE → DONE, PLANNING → QUEUED, etc).
- Cross-channel campaign (same offer running via ads + email + on-site)? Put the offer under section 4 and add one-liner references from each channel section pointing at it.
- Deprecated / off? Move to DONE with a short note on why — don't delete, history matters.
- Cross-link related memory files with `feedback_*.md` / `reference_*.md` slugs so future sessions pick up context.
