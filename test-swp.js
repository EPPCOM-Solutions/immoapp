const cheerio = require('cheerio');

async function test() {
  const url = 'https://immo.swp.de/suche/wohnungen-mieten/stuttgart';
  console.log("Fetching", url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const properties = [];
  $('.list-item').each((_, el) => {
    const title = $(el).find('h2').text().trim();
    if(title) properties.push(title);
  });
  console.log("Found:", properties.length);
  if(properties.length === 0) {
     console.log("HTML Sample:", html.substring(0, 500));
  }
}
test();
