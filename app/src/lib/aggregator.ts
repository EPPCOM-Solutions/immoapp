import * as cheerio from 'cheerio';
import { Property, SearchIntent, SearchSettings } from '../types/property';

async function getKleinanzeigenLocationId(location: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query=${encodeURIComponent(location)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    for (const key in data) {
      if (key !== '_0' && key.startsWith('_')) {
        return key.substring(1);
      }
    }
  } catch (e) {
    console.error("Autocomplete Error", e);
  }
  return null;
}

export async function fetchKleinanzeigen(location: string, intent: SearchIntent, propertyType: string, provisionsfrei: boolean, radius: number): Promise<Property[]> {
  let categoryPath = 'wohnung-mieten';
  let categoryId = 'c203';
  if (intent === 'rent') {
    if (propertyType === 'haus') { categoryPath = 'haus-mieten'; categoryId = 'c205'; }
    else if (propertyType === 'grundstueck') { categoryPath = 'grundstuecke'; categoryId = 'c207'; }
  } else if (intent === 'buy' || intent === 'investment') {
    if (propertyType === 'haus') { categoryPath = 'haus-kaufen'; categoryId = 'c208'; }
    else if (propertyType === 'grundstueck') { categoryPath = 'grundstuecke'; categoryId = 'c207'; }
    else { categoryPath = 'wohnung-kaufen'; categoryId = 'c196'; }
  }

  const locId = await getKleinanzeigenLocationId(location);
  const safeLocation = location.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const radiusQuery = radius > 0 ? `r${radius}` : '';
  const url = locId 
    ? `https://www.kleinanzeigen.de/s-${categoryPath}/${safeLocation}/${categoryId}l${locId}${radiusQuery}`
    : `https://www.kleinanzeigen.de/s-${categoryPath}/${safeLocation}/${categoryId}${radiusQuery}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
      next: { revalidate: 60 }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];

    $('article.aditem').each((_, element) => {
      const el = $(element);
      const id = el.attr('data-adid') || String(Math.random());
      const titleEl = el.find('.text-module-begin a');
      const title = titleEl.text().trim();
      const rawHref = titleEl.attr('href') || '';
      const adUrl = rawHref ? `https://www.kleinanzeigen.de${rawHref}` : '';
      const rawPrice = el.find('.aditem-main--middle--price-shipping--price').text().trim();
      const priceVal = parseInt(rawPrice.replace(/\./g, '').replace(/[^\d]/g, ''), 10);
      const price = isNaN(priceVal) ? 0 : priceVal;
      const address = el.find('.aditem-main--top--left').text().trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const rawDesc = el.find('.aditem-main--middle--description').text().trim();
      const tags = el.find('.simpletag').map((i, tag) => $(tag).text().trim()).get();
      let isPrivate = tags.some(t => t.toLowerCase().includes('privat'));
      if (provisionsfrei && !isPrivate) return;

      let rooms: number | null = null;
      let livingSpace: number | null = null;
      tags.forEach(tag => {
        if (tag.toLowerCase().includes('zimmer')) {
          const m = tag.match(/(\d+(?:[.,]\d+)?)/);
          if(m) rooms = parseFloat(m[1].replace(',', '.'));
        }
        if (tag.toLowerCase().includes('m²')) {
          const m = tag.match(/(\d+(?:[.,]\d+)?)/);
          if(m) livingSpace = parseFloat(m[1].replace(',', '.'));
        }
      });
      if (rooms === null) {
        const roomMatch = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:Zimmer|Zi\.|Zi\b)/i);
        if (roomMatch) rooms = parseFloat(roomMatch[1].replace(',', '.'));
      }
      if (livingSpace === null) {
        const spaceMatch = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
        if (spaceMatch) livingSpace = parseFloat(spaceMatch[1].replace(',', '.'));
      }

      let imageUrl = el.find('.imagebox.srpimagebox img').attr('src');
      properties.push({
        id: `ka-${id}`,
        title, address, price, rooms, livingSpace,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
        url: adUrl, source: 'Kleinanzeigen',
        competitionScore: 5, priceTrend: 'steady', isPrivate
      });
    });
    return properties;
  } catch (error) {
    return [];
  }
}

export async function fetchImmowelt(location: string, intent: SearchIntent, propertyType: string, provisionsfrei: boolean): Promise<Property[]> {
  try {
    const slug = location.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let type = 'wohnungen/mieten';
    if (intent === 'rent') {
      if (propertyType === 'haus') type = 'haeuser/mieten';
      else if (propertyType === 'grundstueck') type = 'grundstuecke/mieten';
    } else {
      if (propertyType === 'haus') type = 'haeuser/kaufen';
      else if (propertyType === 'grundstueck') type = 'grundstuecke/kaufen';
      else type = 'wohnungen/kaufen';
    }
    const url = `https://www.immowelt.de/suche/${slug}/${type}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];
    $('.EstateItem-4409d').each((_, el) => {
      const title = $(el).find('h2').text().trim();
      const priceText = $(el).find('[data-test="price"]').text();
      const price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || 0;
      const spaceText = $(el).find('[data-test="area"]').text();
      const sMatch = spaceText.match(/(\d+(?:,\d+)?)/);
      const livingSpace = sMatch ? parseFloat(sMatch[1].replace(',', '.')) : null;
      const roomText = $(el).find('[data-test="rooms"]').text();
      const rMatch = roomText.match(/(\d+(?:,\d+)?)/);
      const rooms = rMatch ? parseFloat(rMatch[1].replace(',', '.')) : null;
      let adUrl = $(el).find('a').attr('href') || '';
      if(adUrl && !adUrl.startsWith('http')) adUrl = `https://www.immowelt.de${adUrl}`;
      const imageUrl = $(el).find('img').attr('src') || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop';
      if (title && price > 0) {
        properties.push({
          id: `iw-${title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}-${price}`,
          title, address: location, price, rooms, livingSpace, imageUrl, url: adUrl || url,
          source: 'Immowelt', competitionScore: 8, priceTrend: 'steady'
        });
      }
    });
    return properties;
  } catch (err) {
    return [];
  }
}

export async function fetchRegional(location: string, intent: SearchIntent, propertyType: string): Promise<Property[]> {
  try {
    const safeLoc = encodeURIComponent(location.toLowerCase());
    const rentBuy = intent === 'rent' ? 'mieten' : 'kaufen';
    let typeParam = 'wohnungen';
    if (propertyType === 'haus') typeParam = 'haeuser';
    else if (propertyType === 'grundstueck') typeParam = 'grundstuecke';
    const url = `https://immo.swp.de/suche/${typeParam}-${rentBuy}/${safeLoc}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];
    $('.featured-listings__item, .results-list__item').each((_, el) => {
      const titleEl = $(el).find('h2, .featured-listings__item__title a, .results-list__item__title a').first();
      const title = titleEl.text().trim();
      let href = titleEl.attr('href') || $(el).find('a').first().attr('href') || '';
      const adUrl = href.startsWith('http') ? href : `https://immo.swp.de${href}`;
      const priceText = $(el).find('.featured-listings__item__price, .results-list__item__price').text() || $(el).text();
      const priceMatch = priceText.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, ''), 10) : 0;
      let img = $(el).find('img').first().attr('data-src') || $(el).find('img').first().attr('src');
      if (img && !img.startsWith('http')) img = `https://immo.swp.de${img}`;
      const text = $(el).text();
      let rooms = null;
      const roomMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:Zimmer|Zi\.|Zi\b)/i);
      if (roomMatch) rooms = parseFloat(roomMatch[1].replace(',', '.'));
      let livingSpace = null;
      const spaceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      if (spaceMatch) livingSpace = parseFloat(spaceMatch[1].replace(',', '.'));
      const isPrivate = text.toLowerCase().includes('von privat') || text.toLowerCase().includes('provisionsfrei');
      if (title && price > 0) {
        properties.push({
          id: `swp-${title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}-${price}`,
          title, address: `${location} (Lokal)`, price, rooms, livingSpace, 
          imageUrl: img || 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=1000&auto=format&fit=crop',
          url: adUrl, source: 'Regionale Zeitungen', competitionScore: 4, priceTrend: 'steady', isPrivate
        });
      }
    });
    return properties.filter((v,i,a)=>a.findIndex(t=>(t.title === v.title))===i);
  } catch(err) {
    return [];
  }
}

export function filterProperties(properties: Property[], settings: SearchSettings): Property[] {
  const { propertyType, maxPrice, minRooms, minSpace } = settings;
  return properties.filter(p => {
    const lowerTitle = p.title.toLowerCase();
    
    // Property Type Filter
    if (propertyType === 'haus') {
      if (lowerTitle.includes('wohnung') && !lowerTitle.includes('haus')) return false;
      if (lowerTitle.includes('apartment') || lowerTitle.includes('etagenwohnung')) return false;
    } else if (propertyType === 'wohnung') {
      if (lowerTitle.includes('einfamilienhaus') || lowerTitle.includes('reihenhaus') || lowerTitle.includes('doppelhaushälfte')) return false;
      if (lowerTitle.includes('haus ') && !lowerTitle.includes('mehrfamilienhaus')) return false;
    } else if (propertyType === 'grundstueck') {
      if (lowerTitle.includes('wohnung') || lowerTitle.includes(' haus ')) return false;
    }

    // Numerical Filters
    if (maxPrice && maxPrice < 2000000 && p.price > 0 && p.price > maxPrice) return false;
    if (minRooms && p.rooms !== null && p.rooms < minRooms) return false;
    if (minSpace && p.livingSpace !== null && p.livingSpace < minSpace) return false;

    return true;
  });
}

export async function aggregateProperties(settings: SearchSettings): Promise<Property[]> {
  const { locations, activePortals: portals, intent, propertyType, provisionsfrei, radius } = settings;
  const promises: Promise<Property[]>[] = [];

  locations.forEach(loc => {
    if (portals.includes('Kleinanzeigen')) promises.push(fetchKleinanzeigen(loc, intent, propertyType, provisionsfrei || false, radius || 0));
    if (portals.includes('Immowelt')) promises.push(fetchImmowelt(loc, intent, propertyType, provisionsfrei || false));
    if (portals.includes('Regional')) promises.push(fetchRegional(loc, intent, propertyType));
  });

  const results = await Promise.all(promises);
  let all = results.reduce((acc, val) => acc.concat(val), []);
  return filterProperties(all, settings);
}
