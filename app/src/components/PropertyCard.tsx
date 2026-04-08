"use client";

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Property, SearchIntent } from '../types/property';
import { MapPin, BedDouble, Maximize, ExternalLink, TrendingUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onSwipe: (id: string, direction: 'left' | 'right') => void;
  intent: SearchIntent;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSwipe, intent }) => {
  const [exitX, setExitX] = useState<number | null>(null);
  const x = useMotionValue(0);
  
  // Image Carousel State
  const [images, setImages] = useState<string[]>(property.imageUrls && property.imageUrls.length > 0 ? property.imageUrls : [property.imageUrl]);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  // Fetch all images lazily if they tap to see more
  const handleNextImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageIndex < images.length - 1) {
      setImageIndex(prev => prev + 1);
      return;
    }
    
    // Fallback if we haven't loaded detail images yet
    if (images.length === 1 && property.url && !loadingImages) {
      setLoadingImages(true);
      try {
        const res = await fetch(`/api/properties/detail?url=${encodeURIComponent(property.url)}`);
        const data = await res.json();
        if (data.imageUrls && data.imageUrls.length > 0) {
          // Merge old and new avoiding duplicates
          const newImages = Array.from(new Set([property.imageUrl, ...data.imageUrls]));
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
    
    let colorClass = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    if (rendite < 3) colorClass = "text-red-400 bg-red-400/10 border-red-400/20";
    else if (rendite >= 3 && rendite < 5) colorClass = "text-amber-400 bg-amber-400/10 border-amber-400/20";

    return (
      <div className={`mt-3 flex items-center justify-between p-3 rounded-xl border backdrop-blur-sm ${colorClass}`}>
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
    );
  };

  const renderMitbewerberScore = () => {
    if (!property.competitionScore) return null;
    const score = property.competitionScore;
    let color = "text-emerald-400";
    if (score > 7) color = "text-red-400";
    else if (score > 4) color = "text-amber-400";

    return (
      <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-900/60 px-2 py-1 rounded border border-slate-700/50 backdrop-blur-md">
        <Activity className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-slate-300">Wettbewerb: <span className={color}>{score}/10</span></span>
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
      className="absolute inset-0 w-full h-[70vh] p-4 cursor-grab active:cursor-grabbing origin-bottom"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden glass shadow-2xl border border-slate-700/50">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent z-10" />
        
        {/* Top Right Source Badge (Non-clickable, just info) */}
        <div className="absolute top-4 right-4 z-40 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-[10px] uppercase font-bold tracking-wider text-slate-400 border border-slate-700 flex items-center gap-1">
          {property.source}
        </div>


        <img src={images[imageIndex]} alt={property.title} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" draggable={false} />
        
        {/* Image Navigation Overlays */}
        <div className="absolute inset-0 z-20 flex">
           <div className="w-1/2 h-full" onClick={handlePrevImage} />
           <div className="w-1/2 h-full" onClick={handleNextImage} />
        </div>

        {/* Carousel Indicators */}
        {images.length > 1 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 z-30 px-4">
            {images.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full bg-white/40 shadow-sm backdrop-blur-md transition-all ${i === imageIndex ? 'bg-white' : ''}`} />
            ))}
          </div>
        )}
        
        {loadingImages && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs text-white">
             Bilder laden...
          </div>
        )}

        {/* Swipe Indicators */}
        <motion.div style={{ opacity: likeOpacity }} className="absolute top-10 left-8 z-30 transform -rotate-12 border-4 border-emerald-400 rounded-xl px-4 py-2 text-emerald-400 font-black text-4xl uppercase tracking-widest bg-emerald-950/40 backdrop-blur-md">
          Merken
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }} className="absolute top-10 right-8 z-30 transform rotate-12 border-4 border-pink-500 rounded-xl px-4 py-2 text-pink-500 font-black text-4xl uppercase tracking-widest bg-pink-950/40 backdrop-blur-md">
          Pass
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 p-6 z-20 text-white">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-2xl font-bold font-sans tracking-tight leading-tight max-w-[70%] drop-shadow-md">{property.title}</h2>
            <div className="text-right">
              <span className="text-3xl font-black text-white decoration-emerald-500 underline decoration-4 underline-offset-4 drop-shadow-md">{property.price > 0 ? property.price.toLocaleString('de-DE') : 'k/A'}</span>
              <span className="text-sm font-medium opacity-80 block">{property.price > 10000 ? '€ Kaufpreis' : '€ Kalt'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-slate-300 text-sm mb-4">
            <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-400" /> <span className="truncate drop-shadow-md">{property.address}</span></div>
            {renderMitbewerberScore()}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 border border-slate-700/50 flex flex-col items-center justify-center">
              <Maximize className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="font-semibold">{property.livingSpace !== null ? `${property.livingSpace} m²` : 'k.A.'}</span>
            </div>
            <div className="flex-1 bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 border border-slate-700/50 flex flex-col items-center justify-center">
              <BedDouble className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="font-semibold">{property.rooms !== null ? `${property.rooms} Zi.` : 'k.A.'}</span>
            </div>
            {property.priceTrend && (
              <div className="flex-1 bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 border border-slate-700/50 flex flex-col items-center justify-center">
                <TrendingUp className={`w-5 h-5 mb-1 ${property.priceTrend === 'reduced' ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="font-semibold text-xs whitespace-nowrap">{property.priceTrend === 'reduced' ? 'Gesunken' : 'Hot'}</span>
              </div>
            )}
          </div>

          {renderRenditeAmpel()}

          {property.url && (
            <a href={property.url} onPointerDown={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-400 rounded-xl font-bold transition-all shadow-lg w-full z-50 relative pointer-events-auto">
              <ExternalLink className="w-4 h-4" /> Originalanzeige öffnen
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
};
