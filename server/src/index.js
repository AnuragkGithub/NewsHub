import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Parser from 'rss-parser';

const app = express();
const PORT = process.env.PORT || 5000;
const parser = new Parser({ timeout: 9000, headers: { 'User-Agent': 'CIVIC360/1.0 (news aggregator; contact: admin@example.com)' } });
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }));

const feeds = [
  { name: 'BBC World', category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC Business', category: 'business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'BBC Science', category: 'science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { name: 'CNN World', category: 'world', url: 'http://rss.cnn.com/rss/edition_world.rss' },
  { name: 'NDTV', category: 'india', url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
  { name: 'The Indian Express', category: 'india', url: 'https://indianexpress.com/section/india/feed/' },
  { name: 'PIB', category: 'india', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1' },
  { name: 'Google News · India', category: 'india', url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en' },
  { name: 'Google News · World', category: 'world', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google News · Defence', category: 'defence', url: 'https://news.google.com/rss/search?q=India+defence+OR+military&hl=en-IN&gl=IN&ceid=IN:en' },
  { name: 'Google News · Environment', category: 'environment', url: 'https://news.google.com/rss/search?q=climate+environment&hl=en-IN&gl=IN&ceid=IN:en' }
];

const sampleNews = [
  { id: 'demo-1', title: 'India’s policy choices in a changing global order: key developments to follow', source: 'CIVIC360 Desk', category: 'india', publishedAt: new Date().toISOString(), url: 'https://pib.gov.in/', summary: 'A sample briefing card. Connect live RSS sources to replace this demonstration content.', image: '', isSample: true },
  { id: 'demo-2', title: 'Climate negotiations and the global transition: what candidates should understand', source: 'CIVIC360 Explainer', category: 'environment', publishedAt: new Date(Date.now()-3600000).toISOString(), url: 'https://news.un.org/en/', summary: 'A concise context-first overview for environment and international relations preparation.', image: '', isSample: true },
  { id: 'demo-3', title: 'Science and technology developments shaping public policy', source: 'CIVIC360 Desk', category: 'science', publishedAt: new Date(Date.now()-7200000).toISOString(), url: 'https://www.isro.gov.in/', summary: 'Follow the original source for the full report. Use the exam lens to connect science with governance.', image: '', isSample: true },
  { id: 'demo-4', title: 'Regional security, maritime cooperation and India’s strategic interests', source: 'CIVIC360 Explainer', category: 'defence', publishedAt: new Date(Date.now()-10800000).toISOString(), url: 'https://www.mea.gov.in/', summary: 'A sample defence and international relations story for the daily briefing layout.', image: '', isSample: true }
];

function normalize(item, source, category) {
  const link = item.link || item.guid || '#';
  const title = (item.title || 'Untitled story').trim();
  return {
    id: Buffer.from(`${source}|${link}`).toString('base64url').slice(0, 36),
    title, source, category,
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    url: link,
    summary: (item.contentSnippet || item.summary || item.content || '').replace(/<[^>]*>/g, '').slice(0, 260),
    image: item.enclosure?.url || item['media:content']?.$.url || ''
  };
}

async function getGuardian() {
  if (!process.env.GUARDIAN_API_KEY) return [];
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key', process.env.GUARDIAN_API_KEY);
  url.searchParams.set('page-size', '25');
  url.searchParams.set('show-fields', 'trailText,thumbnail');
  url.searchParams.set('order-by', 'newest');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Guardian API ${response.status}`);
  const data = await response.json();
  return (data.response?.results || []).map(x => ({ id: `guardian-${x.id}`, title: x.webTitle, source: 'The Guardian', category: x.sectionName?.toLowerCase().includes('world') ? 'world' : 'india', publishedAt: x.webPublicationDate, url: x.webUrl, summary: x.fields?.trailText || '', image: x.fields?.thumbnail || '' }));
}

async function getNewsApi() {
  if (!process.env.NEWSAPI_KEY) return [];
  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('country', 'in'); url.searchParams.set('pageSize', '30'); url.searchParams.set('apiKey', process.env.NEWSAPI_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NewsAPI ${response.status}`);
  const data = await response.json();
  return (data.articles || []).map((x, i) => ({ id: `newsapi-${i}-${Buffer.from(x.url || '').toString('base64url').slice(0,12)}`, title: x.title, source: x.source?.name || 'NewsAPI', category: 'india', publishedAt: x.publishedAt, url: x.url, summary: x.description || '', image: x.urlToImage || '' }));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', name: 'CIVIC360 API', time: new Date().toISOString() }));
app.get('/api/sources', (_req, res) => res.json({ sources: feeds.map(({name, category}) => ({ name, category })), optional: ['Guardian Open Platform', 'NewsAPI', 'YouTube Data API'] }));
app.get('/api/news', async (req, res) => {
  const category = String(req.query.category || 'all').toLowerCase();
  const search = String(req.query.search || '').toLowerCase().trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 36, 1), 100);
  const results = await Promise.allSettled(feeds.map(async feed => {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).slice(0, 18).map(item => normalize(item, feed.name, feed.category));
  }));
  let articles = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const optional = await Promise.allSettled([getGuardian(), getNewsApi()]);
  articles.push(...optional.flatMap(result => result.status === 'fulfilled' ? result.value : []));
  if (!articles.length) articles = [...sampleNews];
  const seen = new Set();
  articles = articles.filter(article => {
    const key = article.url || article.title;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  if (category !== 'all') articles = articles.filter(x => x.category === category);
  if (search) articles = articles.filter(x => `${x.title} ${x.summary} ${x.source}`.toLowerCase().includes(search));
  articles.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json({ articles: articles.slice(0, limit), meta: { count: articles.length, sampleMode: articles.every(x => x.isSample), configuredFeeds: feeds.length, successfulFeeds: results.filter(x => x.status === 'fulfilled').length } });
});

app.get('/api/videos', async (req, res) => {
  if (!process.env.YOUTUBE_API_KEY) return res.json({ videos: [], configured: false, message: 'Add YOUTUBE_API_KEY to enable YouTube search.' });
  const query = String(req.query.query || 'daily current affairs India').slice(0, 100);
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet'); url.searchParams.set('q', `${query} news`); url.searchParams.set('type', 'video');
  url.searchParams.set('videoDuration', 'short'); url.searchParams.set('maxResults', '12'); url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
  const response = await fetch(url);
  if (!response.ok) return res.status(502).json({ error: 'YouTube provider request failed.' });
  const data = await response.json();
  res.json({ configured: true, videos: (data.items || []).map(v => ({ id: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle, thumbnail: v.snippet.thumbnails?.high?.url, url: `https://www.youtube.com/watch?v=${v.id.videoId}` })) });
});

app.listen(PORT, () => console.log(`CIVIC360 API running at http://localhost:${PORT}`));
