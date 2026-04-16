import * as cheerio from 'cheerio';

async function run() {
  const url = 'https://www.kleinanzeigen.de/s-haus-kaufen/stuttgart/c208l9280';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log("Status", res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log("Ads:", $('article.aditem').length);
}
run();
