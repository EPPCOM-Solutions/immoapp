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

export async function fetchImmobilo(location: string, intent: SearchIntent, propertyType: string, provisionsfrei: boolean): Promise<Property[]> {
  try {
    const safeLoc = encodeURIComponent(location.toLowerCase());
    const rentBuy = intent === 'rent' ? 'mieten' : 'kaufen';
    let typeParam = 'wohnung';
    if (propertyType === 'haus') typeParam = 'haus';
    else if (propertyType === 'grundstueck') typeParam = 'grundstueck';
    const url = `https://www.immobilo.de/${rentBuy}/${typeParam}/${safeLoc}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];
    $('.js-bookmark-btn').each((_, el) => {
      const btn = $(el);
      const id = btn.attr('data-id') || '';
      const title = btn.attr('data-title') || '';
      const rawUrl = btn.attr('data-url') || '';
      const adUrl = rawUrl.startsWith('http') ? rawUrl : `https://www.immobilo.de${rawUrl}`;
      const rawPrice = btn.attr('data-price') || '';
      const priceMatch = rawPrice.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, ''), 10) : 0;
      const rooms = parseFloat((btn.attr('data-rooms') || '').replace(',', '.')) || null;
      const livingSpace = parseFloat((btn.attr('data-space') || '').replace(',', '.')) || null;
      const address = btn.attr('data-address') || location;
      const imageUrl = btn.attr('data-image') || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop';
      
      const text = btn.closest('.card').text() || '';
      let isPrivate = text.toLowerCase().includes('provisionsfrei') || text.toLowerCase().includes('von privat');
      
      // Removed the strict provisionsfrei filtering here to show more results initially, but kept it if strictly requested.
      if (provisionsfrei && !isPrivate) return;

      if (title && price > 0) {
        properties.push({
          id: `immo-${id || title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}-${price}`,
          title, address, price, rooms, livingSpace, imageUrl, url: adUrl,
          source: 'Immobilo', competitionScore: 8, priceTrend: 'steady'
        });
      }
    });
    return properties.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
  } catch (err) {
    return [];
  }
}

export async function fetchRegional(location: string, intent: SearchIntent, propertyType: string): Promise<Property[]> {
  try {
    const safeLoc = encodeURIComponent(location.toLowerCase());
    const rentBuy = intent === 'rent' ? 'rental' : 'sale';
    let typeParam = 'apartment';
    if (propertyType === 'haus') typeParam = 'house';
    else if (propertyType === 'grundstueck') typeParam = 'plot';
    
    const url = `https://immo.swp.de/suchergebnisse?t=${typeParam}:${rentBuy}:living&l=${safeLoc}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];
    $('.js-bookmark-btn').each((_, el) => {
      const btn = $(el);
      const id = btn.attr('data-id') || '';
      const title = btn.attr('data-title') || '';
      const rawUrl = btn.attr('data-url') || '';
      const adUrl = rawUrl.startsWith('http') ? rawUrl : `https://immo.swp.de${rawUrl}`;
      const rawPrice = btn.attr('data-price') || '';
      const priceMatch = rawPrice.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, ''), 10) : 0;
      const rooms = parseFloat((btn.attr('data-rooms') || '').replace(',', '.')) || null;
      const livingSpace = parseFloat((btn.attr('data-space') || '').replace(',', '.')) || null;
      const address = btn.attr('data-address') || location;
      const imageUrl = btn.attr('data-image') || 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=1000&auto=format&fit=crop';
      
      const text = btn.closest('.card').text() || '';
      const isPrivate = text.toLowerCase().includes('von privat') || text.toLowerCase().includes('provisionsfrei');
      
      if (title && price > 0) {
        properties.push({
          id: `swp-${id || title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}-${price}`,
          title, address: `${address} (Lokal)`, price, rooms, livingSpace, 
          imageUrl, url: adUrl, source: 'Regionale Zeitungen', competitionScore: 4, priceTrend: 'steady', isPrivate
        });
      }
    });
    return properties.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
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

  const pt = propertyType || 'wohnung';
  locations.forEach(loc => {
    if (portals.includes('Kleinanzeigen')) promises.push(fetchKleinanzeigen(loc, intent, pt, provisionsfrei || false, radius || 0));
    if (portals.includes('Immobilo')) promises.push(fetchImmobilo(loc, intent, pt, provisionsfrei || false));
    if (portals.includes('Regional')) promises.push(fetchRegional(loc, intent, pt));
  });

  const results = await Promise.all(promises);
  let all = results.reduce((acc, val) => acc.concat(val), []);
  return filterProperties(all, settings);
}
