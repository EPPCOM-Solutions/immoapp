import { NextResponse } from 'next/server';
import { SearchIntent, Property } from '../../../types/property';
import { aggregateProperties } from '@/lib/aggregator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationsParam = searchParams.get('locations') || '';
  const portalsParam = searchParams.get('portals') || '';
  const intent = searchParams.get('intent') as SearchIntent || 'rent';
  const propertyType = searchParams.get('propertyType') || 'wohnung';
  const provisionsfrei = searchParams.get('provisionsfrei') === 'true';
  const radius = parseInt(searchParams.get('radius') || '10', 10);
  const minRooms = parseFloat(searchParams.get('minRooms') || '1');
  const minSpace = parseFloat(searchParams.get('minSpace') || '0');
  const maxPrice = parseFloat(searchParams.get('maxPrice') || '2000000');
  
  if (!locationsParam) {
    return NextResponse.json({ error: 'Locations parameter is required' }, { status: 400 });
  }

  const locations = locationsParam.split(',').map(l => l.trim()).filter(Boolean);
  const portalsRaw = portalsParam ? portalsParam.split(',').map(p => p.trim()).filter(Boolean) : [];
  const portals = portalsRaw.length > 0 ? portalsRaw : ['Kleinanzeigen', 'ImmoScout24', 'Immobilo', 'Regional'];
  
  const settings = {
    intent,
    propertyType,
    locations,
    maxPrice,
    minRooms,
    minSpace,
    radius,
    provisionsfrei,
    activePortals: portals
  };

  try {
    // Try N8N Proxy first
    const n8nWebhookUrl = 'https://n8n.eppcom.de/webhook/livingmatch-search';
    let data;
    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (response.ok) {
        data = await response.json();
      }
    } catch (e) {
      console.log("N8N Proxy failed, using local aggregator.");
    }

    let properties: Property[] = data?.properties || await aggregateProperties(settings as any);

    // Provide generic beautiful filler interior images
    const interiorFillers = [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560185016-a36c64bc25d7?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80'
    ];

    properties = properties.map(p => ({
      ...p,
      imageUrls: [
         p.imageUrl,
         interiorFillers[Math.floor(Math.random() * interiorFillers.length)],
         interiorFillers[Math.floor(Math.random() * interiorFillers.length)]
      ].filter(Boolean)
    }));

    return NextResponse.json({ 
      properties, 
      meta: { locations, total: properties.length, viaNode: data ? 'n8n' : 'local' } 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
