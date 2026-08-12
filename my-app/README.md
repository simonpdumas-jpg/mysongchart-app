# MySongChart Application

## Architecture & Hosting Overview
- **Landing Page**: Hosted on **Squarespace** at `mysongchart.com`
- **Web App**: Built with **React + Vite**, hosted on **Vercel** at `app.mysongchart.com`
- **GitHub Repository**: `simonpdumas-jpg/mysongchart-app`
- **DNS Management**: Managed via **Squarespace DNS**
  - **CNAME Record**: `app` -> `e0497a786e548456.vercel-dns-017.com.`

---

## Business Logic & Feature Specifications

### Pricing & Monetization
- **Pro Tier**: $4.99 / month

### Free Tier Restrictions
1. **Watermark**: Full-page diagonal background watermark rendered in Cal Sans at 8% opacity (`rgba(0,0,0,0.08)`) across PDF exports.
2. **Transpose**: Key transposing dropdown is locked/disabled (`disabled={!isPro}`) with a lock badge.
3. **Themes**: Free users can live-preview all design styles (Modern, Classic, Jazz), but PDF downloads are restricted to **Classic** unless upgraded.

---

## Design System & Theme Rules
- **Brand Typography**: Core app titles ("MySongChart" and "Chord Palette") explicitly enforce **Cal Sans** (`'Cal Sans', -apple-system, BlinkMacSystemFont, sans-serif`).
- **Dynamic Theme Engine**:
  - **Modern**: Cal Sans
  - **Classic**: Georgia / Serif
  - **Jazz**: Permanent Marker
- **Lyric Input Formatting**: Sidebar instruction reads *"Paste your lyrics"* with subtext *"Add section headers (e.g. Verse, Chorus) on separate lines."*

---

## Developer Workflows

### Run App Locally
```bash
npm run dev