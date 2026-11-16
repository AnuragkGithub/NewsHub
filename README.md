# CIVIC360 — News & Government Exam Preparation Portal

A React + Vite frontend and Node.js + Express API starter for a premium current-affairs and exam-preparation platform.

## Requirements
- Node.js 20+
- npm 10+

## Run locally
```bash
npm install
cp server/.env.example server/.env
npm run dev
```
- Frontend: http://localhost:5173
- API health: http://localhost:5000/api/health

The frontend includes a built-in sample-news fallback, so the interface remains usable even if an RSS provider is temporarily unavailable. Sample stories are demonstration content, not live reporting.

## News integrations
The Express API aggregates RSS headlines from configured publishers and optionally adds Guardian, NewsAPI and YouTube Data API results. Configure keys in `server/.env` only. Never put provider secrets in React/Vite environment variables.

RSS feeds and provider access can change. Confirm each publisher's current feed availability, terms, attribution requirements, caching rules and permitted reuse before production. This project intentionally displays headline/summary metadata and links to publisher pages; it does not copy full articles or bypass paywalls.

### Optional providers
- `GUARDIAN_API_KEY`: Guardian Open Platform key.
- `NEWSAPI_KEY`: NewsAPI key. Check plan restrictions and redistribution terms.
- `YOUTUBE_API_KEY`: YouTube Data API key. The app searches for short news videos and links to YouTube; the API does not provide a universal unrestricted Shorts feed.

## Included features
- Responsive editorial dashboard with light/dark theme
- World, India, business, science, environment, defence and exam-focused feeds
- Search and category filtering
- Source-linked historical timeline of selected global milestones, from ancient civilizations to the present, with South Asian history and empires included
- Bookmarks saved in browser localStorage
- Daily MCQ quiz with answer explanations and score
- Current-affairs briefing, exam shortcuts and revision widgets
- RSS aggregation API with provider attribution and graceful fallback

## Where the content comes from
- **Current news:** The Express server fetches the RSS feeds listed in `server/src/index.js` each time `/api/news` is requested. Guardian and NewsAPI are added only when their server-side keys are configured. The app does not currently store or archive these articles; feeds generally provide recent headlines only.
- **History timeline:** `client/src/history.js` contains a manually curated set of dated milestones and reference links. It is not a comprehensive historical database or an archive of historical news articles. Use the linked references to verify details; ancient dates may be approximate or disputed.
- **Fallback examples:** `client/src/main.jsx` and `server/src/index.js` contain sample stories shown when live news is unavailable. They are illustrative and should not be mistaken for real current headlines.

## Suggested production roadmap
1. Add authentication and user profiles.
2. Add a database (PostgreSQL) for users, bookmarks, quizzes and editorial notes.
3. Build an admin/CMS workflow for reviewed daily exam briefs.
4. Add scheduled ingestion, deduplication, caching and source health monitoring.
5. Add UPSC/CDS/NDA/SSC syllabus tagging, PYQ mapping and mock-test engine.
6. Review publisher/API licensing before scaling traffic or storing content.

## API endpoints
- `GET /api/health`
- `GET /api/news?category=world&search=climate&limit=30`
- `GET /api/sources`
- `GET /api/videos?query=current%20affairs`
