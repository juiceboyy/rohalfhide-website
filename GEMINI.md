# Ro Halfhide Website — Project Guidelines & Design Rules

## 1. Design Philosophy: No "AI Slop", Keep It Simple
- **Understated & Grounded:** This is an authentic singer-songwriter website, not a SaaS or tech startup. 
- **Prohibited Clichés:**
  - NO pulsing badge pills (e.g. "NEW SINGLE: OUT NOW").
  - NO floating card widgets with glowing borders or decorative metric boxes.
  - NO aggressive multi-layer gradients or shiny glowing buttons.
  - NO marketing buzzwords or corporate copy.
- **Preferred Aesthetics:**
  - Clean, restrained typography with ample breathing room.
  - Editorial layout: high-resolution photography alongside authentic text.
  - Minimalist controls: simple, functional audio player and clear event listings.
  - Subtle, neutral color palette (deep slate/charcoal, crisp white, muted zinc, subtle warm gold/amber accents).

## 2. Language & Voice Integrity
- **Language:** The website is strictly in **English**. Do not translate content to Dutch, even when conversing with the user in Dutch.
- **Artist Voice:** Preserve Ro's original bio, track descriptions, and artist philosophy verbatim. Do not embellish with generic PR filler.

## 3. Development & Git Workflow
- **Active Branch:** Always work, commit, and push on the **`dev`** branch (`origin/dev`).
- **Production Branch:** The **`main`** branch is strictly for production deployments on Netlify. Only merge to `main` upon explicit user request.
- **Framework & Build:** Astro + Tailwind CSS. Ensure `npm run build` succeeds cleanly before pushing.
