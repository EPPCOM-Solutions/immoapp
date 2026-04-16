const cheerio = require('cheerio');
async function run() {
  const url = 'https://www.kleinanzeigen.de/s-wohnung-mieten/stuttgart/preis::800/c203l9280';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log(res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('article.aditem').each((_, el) => {
    console.log($(el).find('.aditem-main--middle--price-shipping--price').text().trim());
  });
}
run();
