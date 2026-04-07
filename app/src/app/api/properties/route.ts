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

async function fetchKleinanzeigen(location: string, intent: SearchIntent, provisionsfrei: boolean, radius: number): Promise<Property[]> {
  // Für MVP: Wir suchen Wohnungen zur Miete oder Kauf. Kapitalanlage sucht primär Häuser/Wohnungen.
  let categoryPath = 'wohnung-mieten';
  let categoryId = 'c203';
  if (intent === 'buy') {
    categoryPath = 'wohnung-kaufen';
    categoryId = 'c196'; // c196 is Wohnung Kaufen, c208 is Haus Kaufen. We use Wohnung as default.
  } else if (intent === 'investment') {
    categoryPath = 'haus-kaufen';
    categoryId = 'c208';
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
        const roomMatch = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*Zimmer/i);
        if (roomMatch) rooms = parseFloat(roomMatch[1].replace(',', '.'));
      }
      if (rooms === null) {
        const titleRoomMatch = title.match(/(\d+(?:[.,]\d+)?)\s*Zi/i) || title.match(/(\d+(?:[.,]\d+)?)\s*Zimmer/i);
        if (titleRoomMatch) rooms = parseFloat(titleRoomMatch[1].replace(',', '.'));
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

async function fetchImmowelt(location: string, intent: SearchIntent, provisionsfrei: boolean): Promise<Property[]> {
  try {
    const slug = location.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const type = intent === 'rent' ? 'wohnungen/mieten' : 'haeuser/kaufen';
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
      const livingSpace = parseInt(spaceText.replace(/[^\d]/g, ''), 10) || null;
      
      const roomText = $(el).find('[data-test="rooms"]').text();
      const rooms = parseInt(roomText.replace(/[^\d]/g, ''), 10) || null;
      
      let adUrl = $(el).find('a').attr('href') || '';
      if(adUrl && !adUrl.startsWith('http')) adUrl = `https://www.immowelt.de${adUrl}`;

      const imageUrl = $(el).find('img').attr('src') || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop';
      
      if (title && price > 0) {
        properties.push({
          id: `iw-${Math.random()}`,
          title, address: location, price, rooms, livingSpace, imageUrl, url: adUrl,
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

function generateMockImmoscout(location: string, intent: SearchIntent): Property[] {
  // ImmoScout24 STRICTLY blocks fetch with 401. So we mock 1-2 entries to show multi-portal working.
  const price = intent === 'rent' ? Math.floor(Math.random() * 800) + 400 : Math.floor(Math.random() * 500000) + 100000;
  return [{
     id: `is24-${Math.random()}`,
     title: `(ImmoScout Mock) Traumhafte Immobilie in ${location}`,
     address: `${location} Zentrum`,
     price: price,
     rooms: 3,
     livingSpace: 75,
     imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1e52b154ce?q=80&w=1000&auto=format&fit=crop',
     url: 'https://www.immobilienscout24.de/',
     source: 'ImmoScout24',
     competitionScore: 9,
     priceTrend: 'hot'
  }];
}

function generateMockImmonet(location: string, intent: SearchIntent): Property[] {
  // Mock für Immonet (da starker Bot-Schutz)
  const price = intent === 'rent' ? Math.floor(Math.random() * 900) + 500 : Math.floor(Math.random() * 400000) + 150000;
  return [{
     id: `imonet-${Math.random()}`,
     title: `(Immonet) Schöne Immobilie in ${location}`,
     address: `${location} Umgebung`,
     price: price,
     rooms: 2.5,
     livingSpace: 65,
     imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
     url: 'https://www.immonet.de/',
     source: 'Immonet',
     competitionScore: 6,
     priceTrend: 'steady'
  }];
}

function generateMockRegional(location: string, intent: SearchIntent): Property[] {
  // Lokales dynamisches Portal Mock
  const portalName = location.toLowerCase().includes('stuttgart') ? 'Stuttgarter Nachrichten' 
    : location.toLowerCase().includes('münchen') ? 'Münchener Merkur'
    : `Lokalportal ${location}`;
    
  const price = intent === 'rent' ? Math.floor(Math.random() * 700) + 400 : Math.floor(Math.random() * 300000) + 100000;
  return [{
     id: `regio-${Math.random()}`,
     title: `(Lokalinserat) Geheimtipp in ${location}`,
     address: `${location}`,
     price: price,
     rooms: 4,
     livingSpace: 90,
     imageUrl: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=1000&auto=format&fit=crop',
     url: '#',
     source: portalName,
     competitionScore: 3, // Regional has less competition
     priceTrend: 'new'
  }];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationsParam = searchParams.get('locations') || '';
  const portalsParam = searchParams.get('portals') || '';
  const intent = searchParams.get('intent') as SearchIntent || 'rent';
  const provisionsfrei = searchParams.get('provisionsfrei') === 'true';
  const radius = parseInt(searchParams.get('radius') || '10', 10);
  
  if (!locationsParam) {
    return NextResponse.json({ error: 'Locations parameter is required' }, { status: 400 });
  }

  const locations = locationsParam.split(',').map(l => l.trim()).filter(Boolean);
  const portals = portalsParam ? portalsParam.split(',').map(p => p.trim()) : ['Kleinanzeigen', 'Immowelt', 'ImmoScout24', 'Immonet', 'Regional']; // default all
  
  try {
    // Run all scrapes concurrently based on selected portals
    const promises: Promise<Property[]>[] = [];
    
    locations.forEach(loc => {
      if (portals.includes('Kleinanzeigen')) {
        promises.push(fetchKleinanzeigen(loc, intent, provisionsfrei, radius));
      }
      if (portals.includes('Immowelt')) {
        promises.push(fetchImmowelt(loc, intent, provisionsfrei));
      }
      if (portals.includes('ImmoScout24')) {
        promises.push(Promise.resolve(generateMockImmoscout(loc, intent))); 
      }
      if (portals.includes('Immonet')) {
        promises.push(Promise.resolve(generateMockImmonet(loc, intent)));
      }
      if (portals.includes('Regional')) {
        promises.push(Promise.resolve(generateMockRegional(loc, intent)));
      }
    });

    const results = await Promise.all(promises);
    
    // Flatten array
    let properties: Property[] = results.reduce((acc, val) => acc.concat(val), []);

    // Shuffle slightly to interleave portals and locations
    properties = properties.sort(() => Math.random() - 0.5);

    return NextResponse.json({ 
      properties, 
      meta: { locations, total: properties.length } 
    });

  } catch (error: any) {
    console.error("Aggregator Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
