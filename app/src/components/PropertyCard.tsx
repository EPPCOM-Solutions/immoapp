"use client";

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Property, SearchIntent } from '../types/property';
import { MapPin, BedDouble, Maximize, ExternalLink, TrendingUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onSwipe: (id: string, direction: 'left' | 'right') => void;
  intent: SearchIntent;
  isBrokerMode?: boolean;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSwipe, intent, isBrokerMode }) => {
  const [exitX, setExitX] = useState<number | null>(null);
  const x = useMotionValue(0);
  
  // Image Carousel State
  const [images, setImages] = useState<string[]>(
    property.imageUrls && property.imageUrls.length > 0
      ? property.imageUrls 
      : [property.imageUrl || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2']
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  const handleNextImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageIndex < images.length - 1) {
      setImageIndex(prev => prev + 1);
      return;
    }

    // Try fetching more details if we only have 1 image and we haven't loaded yet
    if (images.length === 1 && property.url && !loadingImages) {
      setLoadingImages(true);
      try {
        const res = await fetch(`/api/properties/detail?url=${encodeURIComponent(property.url)}`);
        const data = await res.json();
        if (data.imageUrls && data.imageUrls.length > 0) {
          const newImages = Array.from(new Set([property.imageUrl, ...data.imageUrls])).filter(Boolean) as string[];
          setImages(newImages);
          if (newImages.length > 1) {
            setImageIndex(1);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingImages(false);
      }
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageIndex > 0) setImageIndex(prev => prev - 1);
  };

  
  // Transform values for rotation and opacity based on swipe
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  
  // UI indicators for Nope/Like
  const nopeOpacity = useTransform(x, [-100, -50, 0], [1, 0, 0]);
  const likeOpacity = useTransform(x, [0, 50, 100], [0, 0, 1]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 100) {
      setExitX(200);
      onSwipe(property.id, 'right');
    } else if (info.offset.x < -100) {
      setExitX(-200);
      onSwipe(property.id, 'left');
    }
  };

  // Rendite Ampel Calculation (Bruttomietrendite = Kaltmiete * 12 / Kaufpreis * 100)
  const renderRenditeAmpel = () => {
    if (intent === 'rent' || !property.estimatedRent || property.price < 5000) return null;
    
    const rendite = (property.estimatedRent / property.price) * 100;
    const factor = property.price / property.estimatedRent;
    
    let colorClass = "text-orange-400 bg-orange-400/10 border-orange-400/20";
    if (rendite < 3) colorClass = "text-red-400 bg-red-400/10 border-red-400/20";
    else if (rendite >= 3 && rendite < 5) colorClass = "text-amber-400 bg-amber-400/10 border-amber-400/20";

    // Makler Mode: Erweiterte EK-Rendite (Beispiel: 20% EK, 4% Zinsen, 2% Tilgung)
    let ekRenditeDisplay = null;
    if (isBrokerMode) {
       const ek = property.price * 0.2;
       const kredit = property.price * 0.8;
       const zinsUndTilgung = kredit * 0.06; // 6% Annuität pro Jahr
       const cashflow = property.estimatedRent - zinsUndTilgung;
       const ekRendite = (cashflow / ek) * 100;
       
       ekRenditeDisplay = (
         <div className="text-right mt-2 pt-2 border-t border-current/20">
            <div className="text-[10px] opacity-80 uppercase tracking-wider">Erw. EK-Rendite (20% EK)</div>
            <div className="font-bold text-xs">{ekRendite.toFixed(1)}% p.a.</div>
         </div>
       );
    }

    return (
      <div className={`mt-3 p-3 rounded-xl border backdrop-blur-sm ${colorClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <div>
              <div className="text-xs opacity-80">Rendite-Ampel</div>
              <div className="font-bold text-sm">{rendite.toFixed(1)}% Brutto</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Kaufpreisfaktor</div>
            <div className="font-bold text-sm">{factor.toFixed(1)}x</div>
          </div>
        </div>
        {ekRenditeDisplay}
      </div>
    );
  };

  const renderMitbewerberScore = () => {
    if (!property.competitionScore) return null;
    const score = property.competitionScore;
    let color = "text-orange-400";
    if (score > 7) color = "text-red-400";
    else if (score > 4) color = "text-amber-400";

    return (
      <div className="flex items-center gap-1.5 text-xs font-bold bg-stone-900/60 px-2 py-1 rounded border border-stone-700/50 backdrop-blur-md">
        <Activity className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-stone-300">Wettbewerb: <span className={color}>{score}/10</span></span>
      </div>
    );
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={exitX !== null ? { x: exitX, opacity: 0 } : { x: 0, opacity: 1 }}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing origin-bottom"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden glass shadow-2xl border border-stone-700/50">
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/40 to-transparent z-10" />
        
        {/* Top Info Bar */}
        <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none">
           {/* Image Counter & Badges */}
           <div className="flex flex-col gap-2 pointer-events-auto">
             <div className="px-3 py-1.5 rounded-xl bg-stone-950/70 border border-white/10 backdrop-blur-md text-xs font-bold text-white shadow-lg inline-block text-center fit-content max-w-max">
               Bild {imageIndex + 1}/{images.length}
             </div>
             
             {isBrokerMode && property.isPrivate && (
               <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 border border-orange-400/50 backdrop-blur-md text-xs font-black text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] flex items-center gap-1.5 animate-pulse-slow">
                 ✨ VON PRIVAT (Akquise)
               </div>
             )}
           </div>
           
           {/* Originalanzeige Button */}
           {property.url && (
             <a href={property.url} onPointerDown={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-900 text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5 pointer-events-auto shrink-0 self-start">
                <ExternalLink className="w-3.5 h-3.5" /> {property.price === 0 ? 'Zur Anzeige' : 'Zum Angebot'}
             </a>
           )}
        </div>


        <img src={images[imageIndex]} alt={property.title} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" draggable={false} />
        
        {/* Explicit visible Navigation Buttons to keep the rest of the image free for drag gestures */}
        {images.length > 1 && (
          <>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={handlePrevImage} className="absolute left-3 top-[35%] transform -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/80 shadow-xl pointer-events-auto active:scale-95 transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={handleNextImage} className="absolute right-3 top-[35%] transform -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/80 shadow-xl pointer-events-auto active:scale-95 transition-all">
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}


        


        {loadingImages && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs text-white pointer-events-none">
             Bilder laden...
          </div>
        )}

        {/* Swipe Indicators */}
        <motion.div style={{ opacity: likeOpacity }} className="absolute top-10 left-8 z-30 transform -rotate-12 border-4 border-orange-400 rounded-xl px-4 py-2 text-orange-400 font-black text-4xl uppercase tracking-widest bg-orange-950/40 backdrop-blur-md">
          Merken
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }} className="absolute top-10 right-8 z-30 transform rotate-12 border-4 border-pink-500 rounded-xl px-4 py-2 text-pink-500 font-black text-4xl uppercase tracking-widest bg-pink-950/40 backdrop-blur-md">
          Pass
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 p-5 z-20 text-white max-h-[50%] overflow-y-auto hide-scrollbar flex flex-col justify-end">
          <div className="flex justify-between items-start mb-2 shrink-0 gap-3">
            <h2 className="text-xl sm:text-2xl font-bold font-sans tracking-tight leading-tight line-clamp-3 drop-shadow-md">{property.title}</h2>
            <div className="text-right shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-white decoration-orange-500 underline decoration-4 underline-offset-4 drop-shadow-md">{property.price > 0 ? property.price.toLocaleString('de-DE') : 'k/A'}</span>
              <span className="text-sm font-medium opacity-80 block">{property.price > 10000 ? '€ Kaufpreis' : '€ Kalt'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-stone-300 text-sm mb-4 shrink-0">
            <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-orange-400" /> <span className="truncate drop-shadow-md">{property.address}</span></div>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-stone-700/80 rounded border border-stone-600 text-xs text-stone-300">{property.source}</span>
              {renderMitbewerberScore()}
            </div>
          </div>

          <div className="flex gap-4 shrink-0">
            <div className="flex-1 bg-stone-800/80 backdrop-blur-md rounded-2xl p-3 border border-stone-700/50 flex flex-col items-center justify-center">
              <Maximize className="w-5 h-5 text-orange-400 mb-1" />
              <span className="font-semibold">{property.livingSpace !== null ? `${property.livingSpace.toString().replace('.', ',')} m²` : 'k.A.'}</span>
            </div>
            <div className="flex-1 bg-stone-800/80 backdrop-blur-md rounded-2xl p-3 border border-stone-700/50 flex flex-col items-center justify-center">
              <BedDouble className="w-5 h-5 text-orange-400 mb-1" />
              <span className="font-semibold">{property.rooms !== null ? `${property.rooms.toString().replace('.', ',')} Zi.` : 'k.A.'}</span>
            </div>
            {property.priceTrend && (
              <div className="flex-1 bg-stone-800/80 backdrop-blur-md rounded-2xl p-3 border border-stone-700/50 flex flex-col items-center justify-center">
                <TrendingUp className={`w-5 h-5 mb-1 ${property.priceTrend === 'reduced' ? 'text-orange-400' : 'text-amber-400'}`} />
                <span className="font-semibold text-xs whitespace-nowrap">{property.priceTrend === 'reduced' ? 'Gesunken' : 'Hot'}</span>
              </div>
            )}
          </div>

          {renderRenditeAmpel()}


        </div>
      </div>
    </motion.div>
  );
};
