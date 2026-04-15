export type SearchIntent = 'rent' | 'buy' | 'investment';
export type PropertyType = 'wohnung' | 'haus' | 'grundstueck';

export interface Property {
  id: string;
  title: string;
  address: string;
  price: number; // Purchase price or Kaltmiete
  livingSpace: number | null; // Nullable for when scraper fails so we don't drop the ad
  rooms: number | null; // Nullable
  imageUrl: string;
  url?: string; // Original portal link
  imageUrls?: string[]; // Detailed gallery
  source: 'ImmoScout24' | 'Immowelt' | 'Kleinanzeigen' | string;
  // For investment logic
  estimatedRent?: number; // Yearly cold rent estimation if buy
  priorityScore?: number; // KI Score
  competitionScore?: number; // Mitbewerberdichte-Score (1-10)
  priceTrend?: 'new' | 'steady' | 'reduced' | 'hot'; // Preishistorie/Trend
  notes?: string;
  checklist?: Record<string, boolean>; // For visit checks
  isPrivate?: boolean; // Flag if it's von Privat
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  income: number;
  householdSize: number;
  hasPets: boolean;
  applicationText: string;
  portalLogins?: Record<string, { username?: string, password?: string }>;
  emailCredentials?: {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
  };
  isBrokerMode?: boolean;
  isPremium?: boolean;
}

export interface SearchSettings {
  intent: SearchIntent;
  propertyType?: PropertyType;
  locations: string[]; // Up to 3 locations
  maxPrice: number;
  minRooms: number;
  minSpace: number;
  radius: number;
  provisionsfrei?: boolean; // Immosuchmaschine feature: exclusively private/no fee
  activePortals: string[];
}
