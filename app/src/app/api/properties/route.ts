import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Property, SearchIntent } from '../../../types/property';

async function getKleinanzeigenLocationId(location: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query=${encodeURIComponent(location)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    // find the first key that is not '_0'
    for (const key in data) {
      if (key !== '_0' && key.startsWith('_')) {
        return key.substring(1); // e.g. '_9349' -> '9349'
      }
    }
  } catch (e) {
    console.error("Autocomplete Error", e);
  }
  return null;
}

async function fetchKleinanzeigen(location: string, intent: SearchIntent, propertyType: string, provisionsfrei: boolean, radius: number): Promise<Property[]> {
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
  
  // Custom URL logic using extracted ID if available
  const radiusQuery = radius > 0 ? `r${radius}` : '';
  const url = locId 
    ? `https://www.kleinanzeigen.de/s-${categoryPath}/${safeLocation}/${categoryId}l${locId}${radiusQuery}`
    : `https://www.kleinanzeigen.de/s-${categoryPath}/${safeLocation}/${categoryId}${radiusQuery}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
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
      if (provisionsfrei && !isPrivate) {
        // Strict provisionsfrei filter - skip if no 'privat' tag on kleinanzeigen
        return;
      }

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
      if (rooms === null) {
        const titleRoomMatch = title.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:Zimmer|Zi\.|Zi\b)/i);
        if (titleRoomMatch) rooms = parseFloat(titleRoomMatch[1].replace(',', '.'));
      }
      if (rooms === null) {
         // Also check for something like "2 ZKB", "3 ZKBB"
         const zkbMatch = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:ZKB|ZBB|Zimmern)/i) || title.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:ZKB|ZBB)/i);
         if (zkbMatch) rooms = parseFloat(zkbMatch[1].replace(',', '.'));
      }
      if (livingSpace === null) {
        const spaceMatch = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
        if (spaceMatch) livingSpace = parseFloat(spaceMatch[1].replace(',', '.'));
      }

      let imageUrl = el.find('.imagebox.srpimagebox img').attr('src');
      if (imageUrl && !imageUrl.startsWith('http')) imageUrl = imageUrl;
      
      const competitionScore = Math.floor(Math.random() * 5) + 5;
      const priceTrendValue = Math.random() > 0.8 ? 'reduced' : 'steady';

      if (title && price > 0) {
        properties.push({
          id: `ka-${id}`,
          title,
          address,
          price,
          rooms,
          livingSpace,
          imageUrl: imageUrl || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
          url: adUrl,
          source: 'Kleinanzeigen',
          estimatedRent: intent === 'investment' ? (price * 0.04) : undefined,
          competitionScore,
          priceTrend: priceTrendValue as any
        });
      }
    });

    return properties;
  } catch (error) {
    console.error("KA Scraper Error:", error);
    return [];
  }
}

async function fetchImmowelt(location: string, intent: SearchIntent, propertyType: string, provisionsfrei: boolean): Promise<Property[]> {
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
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) return [];
    
    // Immowelt often limits HTML without js. For MVP, we will extract what we can or return empty if blocked.
    const html = await response.text();
    const $ = cheerio.load(html);
    const properties: Property[] = [];

    // Depending on their DOM
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
      
      const hashId = title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15) || Math.random().toString(36).slice(2, 10);
      if (title && price > 0) {
        properties.push({
          id: `iw-${hashId}-${price}`,
          title, address: location, price, rooms, livingSpace, imageUrl, url: adUrl || url,
          source: 'Immowelt', competitionScore: 8, priceTrend: 'steady'
        });
      }
    });

    return properties;
  } catch (err) {
    console.error("Immowelt Scraper Error", err);
    return [];
  }
}

function generateMockImmoscout(location: string, intent: SearchIntent, propertyType: string): Property[] {
  // We cannot scrape IS24 directly due to bot protection, so we provide an honest deep-link search card.
  let is24Intent = 'wohnung-mieten';
  if (intent === 'rent') {
    if (propertyType === 'haus') is24Intent = 'haus-mieten';
    else if (propertyType === 'grundstueck') is24Intent = 'grundstueck-mieten';
  } else {
    if (propertyType === 'haus') is24Intent = 'haus-kaufen';
    else if (propertyType === 'grundstueck') is24Intent = 'grundstueck-kaufen';
    else is24Intent = 'wohnung-kaufen';
  }
  const safeLoc = location.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return [{
     id: `is24-search-${safeLoc}-${intent}`,
     title: `ImmoScout24: Alle ${propertyType} Angebote in ${location} ansehen`,
     address: `${location} Einzugsgebiet`,
     price: 0,
     rooms: null,
     livingSpace: null,
     imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop', // generic abstract home 
     url: `https://www.immobilienscout24.de/Suche/de/${safeLoc}/${is24Intent}`,
     source: 'ImmoScout24 Portal',
     competitionScore: 9,
     priceTrend: 'hot'
  }];
}

function generateMockImmobilo(location: string, intent: SearchIntent, propertyType: string): Property[] {
  const immobiloIntent = intent === 'rent' ? 'mieten' : 'kaufen';
  const safeLoc = location.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return [{
     id: `immobilo-search-${safeLoc}-${intent}`,
     title: `Immobilo: Weitere Angebote in ${location} vergleichen`,
     address: `${location} Einzugsgebiet`,
     price: 0,
     rooms: null,
     livingSpace: null,
     imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
     url: `https://www.immobilo.de/${propertyType}-${immobiloIntent}/${encodeURIComponent(location)}`,
     source: 'Immobilo Portal',
     competitionScore: 6,
     priceTrend: 'steady'
  }];
}

async function fetchRegional(location: string, intent: SearchIntent, propertyType: string): Promise<Property[]> {
  try {
    const safeLoc = encodeURIComponent(location.toLowerCase());
    const rentBuy = intent === 'rent' ? 'mieten' : 'kaufen';
    let typeParam = 'wohnungen';
    if (propertyType === 'haus') typeParam = 'haeuser';
    else if (propertyType === 'grundstueck') typeParam = 'grundstuecke';
    
    const url = `https://immo.swp.de/suche/${typeParam}-${rentBuy}/${safeLoc}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 60 }
    });

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
      let livingSpace = null;
      
      const roomMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[-]?(?:Zimmer|Zi\.|Zi\b)/i);
      if (roomMatch) rooms = parseFloat(roomMatch[1].replace(',', '.'));
      
      const spaceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      if (spaceMatch) livingSpace = parseFloat(spaceMatch[1].replace(',', '.'));

      const isPrivate = text.toLowerCase().includes('von privat') || text.toLowerCase().includes('provisionsfrei');
      
      if (title && price > 0 && href) {
        const hashId = title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
        properties.push({
          id: `swp-${hashId}-${price}`,
          title: title,
          address: `${location} (Lokal)`,
          price,
          rooms,
          livingSpace,
          imageUrl: img || 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=1000&auto=format&fit=crop',
          url: adUrl,
          source: 'Regionale Zeitungen',
          competitionScore: 4,
          priceTrend: 'steady',
          isPrivate
        });
      }
    });
    
    return properties.filter((v,i,a)=>a.findIndex(t=>(t.title === v.title))===i).slice(0, 12);
  } catch(err) {
    console.error("Regional Scraper Error", err);
    return [];
  }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationsParam = searchParams.get('locations') || '';
  const portalsParam = searchParams.get('portals') || '';
  const intent = searchParams.get('intent') as SearchIntent || 'rent';
  const propertyType = searchParams.get('propertyType') || 'wohnung';
  const provisionsfrei = searchParams.get('provisionsfrei') === 'true';
  const radius = parseInt(searchParams.get('radius') || '10', 10);
  const minRooms = parseFloat(searchParams.get('minRooms') || '1');
  
  if (!locationsParam) {
    return NextResponse.json({ error: 'Locations parameter is required' }, { status: 400 });
  }

  const locations = locationsParam.split(',').map(l => l.trim()).filter(Boolean);
  const portalsRaw = portalsParam ? portalsParam.split(',').map(p => p.trim()).filter(Boolean) : [];
  const portals = portalsRaw.length > 0 ? portalsRaw : ['Kleinanzeigen', 'Immowelt', 'ImmoScout24', 'Immobilo', 'Regional']; // default all
  
  try {
    // Redirect logic to new N8N webhook
    const n8nWebhookUrl = 'https://n8n.eppcom.de/webhook/livingmatch-search';
    
    // Prepare the payload the same way we received it
    const payload = {
      locations,
      portals,
      intent,
      propertyType,
      provisionsfrei,
      radius,
      minRooms
    };

    let n8nSuccess = false;
    let data;
    try {
      console.log("Routing search request to N8N Webhook...", n8nWebhookUrl);
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        data = await response.json();
        n8nSuccess = true;
      }
    } catch (e) {
      console.log("N8N Proxy not available, falling back to local scraper...");
    }

    if (n8nSuccess && data && data.properties) {
      return NextResponse.json({ 
        properties: data.properties, 
        meta: { locations, total: data.properties.length, viaNode: 'n8n' } 
      });
    }

    // --- FALLBACK LOGIC ---
    console.log("Using Local Scrapers as fallback...");
    const promises: Promise<Property[]>[] = [];
    
    locations.forEach(loc => {
      if (portals.includes('Kleinanzeigen')) {
        promises.push(fetchKleinanzeigen(loc, intent, propertyType, provisionsfrei, radius));
      }
      if (portals.includes('Immowelt')) {
        promises.push(fetchImmowelt(loc, intent, propertyType, provisionsfrei));
      }
      if (portals.includes('ImmoScout24')) {
        promises.push(Promise.resolve(generateMockImmoscout(loc, intent, propertyType))); 
      }
      if (portals.includes('Immobilo')) {
        promises.push(Promise.resolve(generateMockImmobilo(loc, intent, propertyType)));
      }
      if (portals.includes('Regional')) {
        promises.push(fetchRegional(loc, intent, propertyType));
      }
    });

    const results = await Promise.all(promises);
    let fallbackProperties: Property[] = results.reduce((acc, val) => acc.concat(val), []);
    fallbackProperties = fallbackProperties.sort(() => Math.random() - 0.5);

    // Provide generic beautiful filler interior images for the galleries 
    // so tests / friends see full swipeable capabilities without server IP blocks
    const interiorFillers = [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560185016-a36c64bc25d7?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80'
    ];

    fallbackProperties = fallbackProperties.map(p => ({
      ...p,
      imageUrls: [
         p.imageUrl,
         interiorFillers[Math.floor(Math.random() * interiorFillers.length)],
         interiorFillers[Math.floor(Math.random() * interiorFillers.length)]
      ].filter(Boolean)
    }));

    return NextResponse.json({ 
      properties: fallbackProperties, 
      meta: { locations, total: fallbackProperties.length, viaNode: 'local' } 
    });

  } catch (error: any) {
    console.error("Aggregator N8N/Local Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
