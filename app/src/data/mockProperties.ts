import { Property } from '../types/property';

export const mockProperties: Property[] = [
  {
    id: 'p1',
    title: 'Modernes Loft mit Skyline-Blick',
    address: 'Frankfurt am Main, Europaviertel',
    price: 850000,
    livingSpace: 110,
    rooms: 3,
    imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
    source: 'ImmoScout24',
    estimatedRent: 36000 // 3000 cold rent / month
  },
  {
    id: 'p2',
    title: 'Charmante Altbau-Wohnung',
    address: 'Berlin, Prenzlauer Berg',
    price: 1800,
    livingSpace: 85,
    rooms: 2.5,
    imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1000&auto=format&fit=crop',
    source: 'Kleinanzeigen',
  },
  {
    id: 'p3',
    title: 'Kapitalanlage: Solides Mehrfamilienhaus',
    address: 'Leipzig, Plagwitz',
    price: 1200000,
    livingSpace: 450,
    rooms: 15,
    imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1000&auto=format&fit=crop',
    source: 'Immobilo',
    estimatedRent: 72000 // 6000 cold rent / month
  },
  {
    id: 'p4',
    title: 'Lichtdurchflutetes Studio',
    address: 'München, Schwabing',
    price: 2100,
    livingSpace: 60,
    rooms: 2,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1e5250ce73?q=80&w=1000&auto=format&fit=crop',
    source: 'ImmoScout24',
  },
  {
    id: 'p5',
    title: 'Neubau-Penthouse',
    address: 'Hamburg, HafenCity',
    price: 1500000,
    livingSpace: 140,
    rooms: 4,
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
    source: 'Immobilo',
    estimatedRent: 54000
  }
];
