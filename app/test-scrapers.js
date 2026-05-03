const cheerio = require('cheerio');
async function fetchImmowelt() {
  const url = "https://www.immowelt.de/suche/berlin/wohnungen/mieten";
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' } });
  console.log("Immowelt Status:", response.status);
  const text = await response.text();
  console.log("Immowelt Length:", text.length);
  if (text.includes("captcha") || text.includes("Access denied")) console.log("Immowelt blocked!");
}
async function fetchRegional() {
  const url = "https://immo.swp.de/suche/wohnungen-mieten/ulm";
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log("Regional Status:", response.status);
  const text = await response.text();
  console.log("Regional Length:", text.length);
  const $ = cheerio.load(text);
  console.log("Regional items found:", $('.featured-listings__item, .results-list__item').length);
}
fetchImmowelt().then(fetchRegional);
