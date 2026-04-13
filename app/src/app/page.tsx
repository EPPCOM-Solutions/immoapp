"use client";

import React, { useState, useEffect } from 'react';
import { PropertyCard } from '../components/PropertyCard';
import { SearchSettingsDialog } from '../components/SearchSettingsDialog';
import { BottomNav } from '../components/BottomNav';
import { ProfileVault } from '../components/ProfileVault';
import { mockProperties } from '../data/mockProperties';
import { Property, SearchSettings, UserProfile } from '../types/property';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Settings2, Send, CheckCircle2, Trash2 } from 'lucide-react';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<'discover' | 'saved' | 'profile'>('discover');
  const [showSettings, setShowSettings] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Local Storage State for GDPR Compliance
  const [savedProperties, setSavedProperties] = useLocalStorage<Property[]>('immo_saved', []);
  const [profile, setProfile] = useLocalStorage<UserProfile>('immo_profile', {
    name: '',
    email: '',
    phone: '',
    income: 0,
    householdSize: 1,
    hasPets: false,
    applicationText: 'Sehr geehrte Damen und Herren,\n\nhiermit bewerbe ich mich um die angebotene Immobilie. Alle Unterlagen (Gehalt, Schufa) liegen vollständig vor und können sofort nachgereicht werden.\n\nIch freue mich über einen Besichtigungstermin.\n\nMit freundlichen Grüßen'
  });
  const [settings, setSettings] = useLocalStorage<SearchSettings>('immo_settings', {
    intent: 'rent',
    propertyType: 'wohnung',
    locations: [],
    maxPrice: 2000,
    minRooms: 2,
    minSpace: 50,
    radius: 10,
    provisionsfrei: false,
    activePortals: ['Kleinanzeigen', 'Immowelt', 'ImmoScout24', 'Immobilo', 'Regional']
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  // Fetch properties from backend
  useEffect(() => {
    const fetchLiveProperties = async () => {
      if (!settings.locations || settings.locations.length === 0) {
        setProperties([]);
        return;
      }
      
      setIsLoading(true);
      setError('');
      
      try {
        const locationsQuery = encodeURIComponent(settings.locations.join(','));
        const portalsQuery = encodeURIComponent((settings.activePortals || []).join(','));
        const radiusConfig = settings.radius || 10;
        const pType = settings.propertyType || 'wohnung';
        const res = await fetch(`/api/properties?locations=${locationsQuery}&portals=${portalsQuery}&intent=${settings.intent}&propertyType=${pType}&provisionsfrei=${settings.provisionsfrei ? 'true' : 'false'}&radius=${radiusConfig}`);
        if (!res.ok) {
           throw new Error(await res.text());
        }
        const data = await res.json();
        
        // Apply frontend fine grain filtering
        const filtered = (data.properties || []).filter((p: Property) => {
          // If a max price is set below the 2Mil edge case, rule out if strictly higher.
          if (settings.maxPrice < 2000000 && p.price > 0 && p.price > settings.maxPrice) return false;
          
          // Tolerant minRooms check: Wenn die Räume nicht parsebar waren (null) wie bei ImmoScout/Regional, filtern wir sie absichtlich NICHT raus.
          if (settings.minRooms > 1 && p.rooms !== null && p.rooms < settings.minRooms) return false;
          
          // Tolerant minSpace check: If user cares (>10), drop ONLY if we are sure it's smaller. Null passes.
          if (settings.minSpace > 10 && p.livingSpace !== null && p.livingSpace < settings.minSpace) return false;
          
          return true;
        });

        // Smart Alerts: Bewertungs-API aufrufen (KI Scoring)
        let finalProperties = filtered;
        try {
          const evalRes = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: filtered, profile })
          });
          if (evalRes.ok) {
            const evalData = await evalRes.json();
            if (evalData.properties) {
              finalProperties = evalData.properties;
            }
          }
        } catch (e) {
          console.error("Evaluation failed", e);
        }

        setProperties(finalProperties);
      } catch (err: any) {
        console.error(err);
        setError('Leider wurden wir vom Immo-Portal für diese Region momentan blockiert oder der Ort existiert nicht.');
        setProperties([]);
      } finally {
        setIsLoading(false);
        setCurrentIndex(0);
      }
    };

    fetchLiveProperties();
  }, [settings]);

  // Purge old broken links from localStorage that might be cached from earlier iterations
  useEffect(() => {
    const hasBrokenLinks = savedProperties.some(p => 
      !p.url || 
      p.url.includes('google.com/search') || 
      p.url.includes('immobilienscout24.de/Suche/radius')
    );
    
    if (hasBrokenLinks) {
      setSavedProperties(savedProperties.map(p => {
        if (!p.url) return p;
        if (p.url.includes('google.com/search')) {
           const searchName = p.source.toLowerCase().replace(/[^a-z0-9]/g, '');
           return { ...p, url: `https://www.${searchName}.de/immobilien/suche?q=${encodeURIComponent(p.address)}` };
        }
        if (p.url.includes('immobilienscout24.de/Suche/radius')) {
           return { ...p, url: 'https://www.immobilienscout24.de/' };
        }
        return p;
      }));
    }
  }, [savedProperties, setSavedProperties]);

  const handleSwipe = (id: string, direction: 'left' | 'right') => {
    if (direction === 'right') {
      const property = properties.find(p => p.id === id);
      if (property && !savedProperties.find(p => p.id === property.id)) {
        setSavedProperties([...savedProperties, property]);
      }
    }
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
    }, 200); // Wait for animation
  };

  const handleApply = async (id: string) => {
    const property = savedProperties.find(p => p.id === id);
    if (!property) return;

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, profile })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || 'Fehler bei der Bewerbung');
        return;
      }
      alert(data.message);
      setAppliedIds([...appliedIds, id]);
    } catch (e) {
      alert('Netzwerkfehler');
    }
  };

  const exportPDF = () => {
    // Einfacher MVP Export
    window.print();
  };

  const exportEmail = () => {
    if (savedProperties.length === 0) return;
    const subject = encodeURIComponent("Meine gemerkten Immobilien (LivingMatch)");
    let body = "Hier sind meine gemerkten Immobilien:\n\n";
    savedProperties.forEach(p => {
       body += `🏠 ${p.title}\n📍 ${p.address}\n💰 ${p.price > 100 ? `${p.price} €` : 'k/A'}\n🔗 ${p.url || 'App-intern'}\n`;
       if (p.notes) {
         body += `📝 Notiz: ${p.notes}\n`;
       }
       body += `\n----------------------\n\n`;
    });
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  const updateNotes = (id: string, notes: string) => {
    setSavedProperties(savedProperties.map(p => p.id === id ? { ...p, notes } : p));
  };

  const renderDiscover = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-8">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-6"></div>
           <h2 className="text-xl font-bold text-white mb-2">Scanne Portale...</h2>
           <p className="text-stone-400 text-sm">Suche nach Inhalten in {settings.locations?.join(', ') || '...'} (Live)</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-8">
           <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-500 font-bold text-2xl">!</div>
           <h2 className="text-xl font-bold text-white mb-2">Fehler beim Abruf</h2>
           <p className="text-stone-400 text-sm">{error}</p>
           <button onClick={() => setShowSettings(true)} className="mt-8 px-6 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold">Filter ändern</button>
        </div>
      );
    }

    if (properties.length === 0 || currentIndex >= properties.length) {
      return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-8">
          <div className="w-24 h-24 bg-stone-800 rounded-full flex items-center justify-center mb-6 border border-stone-700">
             <Settings2 className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Keine Inserate mehr</h2>
          <p className="text-stone-400 text-sm">Passe deine Sucheinstellungen an oder warte auf neue Angebote (Echtzeit-Push in Phase 2).</p>
          <button 
            onClick={() => setShowSettings(true)}
            className="mt-8 px-6 py-3 bg-orange-500/20 text-orange-400 rounded-xl font-bold border border-orange-500/30"
          >
            Filter anpassen
          </button>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full mt-4">
        <div className="absolute inset-0 flex justify-center">
          {/* Render cards inverted so the current index is on top */}
          {[...properties]
            .slice(currentIndex, currentIndex + 3) // Only render top 3 for performance
            .reverse()
            .map((property, idx, arr) => {
              const isTop = idx === arr.length - 1;
              return (
                <div key={property.id} className="absolute inset-0 w-full flex justify-center pointer-events-none">
                  <div className={`w-full max-w-[90%] transition-transform duration-300 ${isTop ? 'pointer-events-auto scale-100 transtone-y-0 z-20' : 'scale-95 -transtone-y-4 opacity-50 z-10'}`}>
                    {isTop && (
                      <PropertyCard 
                        property={property} 
                        onSwipe={handleSwipe}
                        intent={settings.intent}
                      />
                    )}
                    {!isTop && (
                       // Mock background cards
                       <div className="w-full h-[70vh] p-4">
                         <div className="w-full h-full rounded-3xl glass backdrop-blur-sm border-white/5 bg-stone-800/40" />
                       </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  const renderSaved = () => (
    <div className="h-full overflow-y-auto pb-32 px-6 pt-8 hide-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-white">Gemerkt ({savedProperties.length})</h1>
        {savedProperties.length > 0 && (
          <div className="flex gap-2">
            <button onClick={exportEmail} className="px-3 py-1.5 bg-stone-800 text-orange-400 text-xs font-bold rounded-lg border border-stone-700">
              E-Mail Senden
            </button>
            <button onClick={exportPDF} className="px-3 py-1.5 bg-stone-800 text-orange-400 text-xs font-bold rounded-lg border border-stone-700">
              PDF Export
            </button>
          </div>
        )}
      </div>
      {savedProperties.length === 0 ? (
        <p className="text-stone-400 text-center mt-20">Noch keine Immobilien favorisiert.</p>
      ) : (
        <div className="space-y-4">
          {savedProperties.map(property => {
            const hasApplied = appliedIds.includes(property.id);
            return (
              <div key={property.id} className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700 backdrop-blur-md">
                <div className="flex gap-4">
                  <img src={property.imageUrl} className="w-20 h-20 rounded-xl object-cover" alt="" />
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-sm line-clamp-1">{property.title}</h3>
                    <p className="text-orange-400 font-bold mt-1">{property.price.toLocaleString()} €</p>
                    <p className="text-stone-400 text-xs mt-1 truncate">{property.source}</p>
                  </div>
                </div>
                
                {property.url && (
                  <a 
                    href={property.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="mt-3 block w-full text-center py-2 bg-stone-700/50 hover:bg-orange-500/20 text-orange-400 border border-stone-600 hover:border-orange-500/50 rounded-lg text-xs font-bold transition-all"
                  >
                    Anzeige direkt öffnen
                  </a>
                )}
                
                <div className="mt-4 pt-4 border-t border-stone-700/50 flex gap-2">
                  <button 
                    onClick={() => {
                      if(!hasApplied) handleApply(property.id);
                    }}
                    className={`flex-1 p-3 flex justify-center text-sm items-center gap-2 rounded-xl font-bold transition-all ${
                      hasApplied 
                        ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30' 
                        : 'bg-orange-500 text-stone-900 hover:bg-orange-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    }`}
                  >
                    {hasApplied ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {hasApplied ? 'Bewerbung versendet' : 'Bewerbung senden'}
                  </button>
                  <button 
                    onClick={() => setSavedProperties(savedProperties.filter(p => p.id !== property.id))}
                    className="p-3 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl border border-stone-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Notes Section */}
                <div className="mt-3">
                   <textarea
                     className="w-full bg-stone-900/50 text-stone-300 text-xs p-2 rounded-lg border border-stone-700 focus:border-orange-500 outline-none"
                     rows={2}
                     placeholder="Notizen / Checkliste für Besichtigung..."
                     value={property.notes || ''}
                     onChange={(e) => updateNotes(property.id, e.target.value)}
                   />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full relative flex flex-col pt-8">
      {/* Header */}
      {currentTab === 'discover' && (
        <div className="px-8 pb-4 flex justify-between items-center z-40">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 tracking-tight leading-none mb-1">
              LivingMatch
            </h1>
            <p className="text-stone-300 text-xs font-medium italic tracking-wide">
              Dein Zuhause, perfekt gematcht.
            </p>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 glass rounded-full text-stone-300 hover:text-white transition-colors"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {currentTab === 'discover' && renderDiscover()}
        {currentTab === 'saved' && renderSaved()}
        {currentTab === 'profile' && <ProfileVault profile={profile} setProfile={setProfile} />}
      </div>

      <BottomNav currentTab={currentTab} setTab={setCurrentTab} />

      {/* Settings Dialog Overlay */}
      {showSettings && (
        <SearchSettingsDialog 
          settings={settings} 
          setSettings={setSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
