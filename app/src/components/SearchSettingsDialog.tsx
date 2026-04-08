"use client";

import React, { useState } from 'react';
import { SearchSettings, SearchIntent, PropertyType } from '../types/property';
import { Settings, X, Info, Save } from 'lucide-react';

interface Props {
  settings: SearchSettings;
  setSettings: (s: SearchSettings) => void;
  onClose: () => void;
}

export const SearchSettingsDialog: React.FC<Props> = ({ settings, setSettings, onClose }) => {
  const [localSettings, setLocalSettings] = useState<SearchSettings>({
    ...settings,
    locations: Array.isArray(settings.locations) && settings.locations.length > 0 ? settings.locations : []
  });
  const [newLocation, setNewLocation] = useState('');

  const handleSave = () => {
    let finalLocations = [...localSettings.locations];
    const loc = newLocation.trim();
    if (loc && finalLocations.length < 3 && !finalLocations.includes(loc)) {
      finalLocations.push(loc);
    }
    
    setSettings({ ...localSettings, locations: finalLocations });
    onClose();
  };

  const addLocation = () => {
    const loc = newLocation.trim();
    if (loc && localSettings.locations.length < 3 && !localSettings.locations.includes(loc)) {
      setLocalSettings({...localSettings, locations: [...localSettings.locations, loc]});
      setNewLocation('');
    }
  };

  const removeLocation = (locToRemove: string) => {
    setLocalSettings({...localSettings, locations: localSettings.locations.filter(l => l !== locToRemove)});
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto hide-scrollbar pb-24">
      <div className="flex justify-between items-center mb-8 pt-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="text-emerald-400" />
          Such-Filter
        </h2>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl text-emerald-100 text-sm mb-6 flex gap-3">
        <Info className="w-5 h-5 text-emerald-400 shrink-0" />
        <p>Deine Sucheinstellungen werden portalübergreifend angewandt (ImmoScout24, Immowelt, Kleinanzeigen).</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">Art der Suche</label>
          <div className="grid grid-cols-3 gap-2">
            {(['rent', 'buy', 'investment'] as SearchIntent[]).map(intent => (
              <button
                key={intent}
                onClick={() => setLocalSettings({...localSettings, intent})}
                className={`p-3 rounded-xl text-sm font-semibold transition-all border ${localSettings.intent === intent ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                {intent === 'rent' ? 'Zur Miete' : intent === 'buy' ? 'Kauf (Selbst)' : 'Kapitalanlage'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">Objektart</label>
          <div className="grid grid-cols-3 gap-2">
            {(['wohnung', 'haus', 'grundstueck'] as PropertyType[]).map(ptype => {
              const isActive = (localSettings.propertyType || 'wohnung') === ptype;
              return (
                 <button
                   key={ptype}
                   onClick={() => setLocalSettings({...localSettings, propertyType: ptype})}
                   className={`p-3 rounded-xl text-sm font-semibold transition-all border ${isActive ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                 >
                   {ptype === 'wohnung' ? 'Wohnung' : ptype === 'haus' ? 'Haus' : 'Grundstück'}
                 </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
             <label className="text-xs uppercase tracking-wider text-slate-400 font-bold block">Orte / Regionen</label>
             <span className="text-xs text-slate-500">{localSettings.locations.length}/3 Orte</span>
          </div>
          
          {localSettings.locations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {localSettings.locations.map(loc => (
                <div key={loc} className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/30 text-sm font-bold">
                  {loc}
                  <button onClick={() => removeLocation(loc)} className="p-0.5 hover:bg-emerald-500/30 rounded-full transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {localSettings.locations.length < 3 && (
            <div className="flex gap-2">
              <input 
                type="text"
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLocation()}
                placeholder="Stadt, PLZ oder Stadtteil..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none placeholder-slate-500"
              />
              <button onClick={addLocation} className="px-4 py-3 bg-slate-700 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 transition-colors font-bold rounded-xl border border-slate-600">
                Hinzufügen
              </button>
            </div>
          )}
        </div>

        <div>
           <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex justify-between">
             <span>Maximal-Preis</span>
             <span className="text-emerald-400">{localSettings.maxPrice.toLocaleString('de-DE')} €</span>
           </label>
            <input 
              type="range" 
              min={localSettings.intent === 'rent' ? 300 : 50000} 
              max={localSettings.intent === 'rent' ? 5000 : 2000000} 
              step={localSettings.intent === 'rent' ? 50 : 10000}
              value={localSettings.maxPrice}
              onChange={e => setLocalSettings({...localSettings, maxPrice: Number(e.target.value)})}
              className="w-full accent-emerald-500"
            />
         </div>

         <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex justify-between">
              <span>Umkreis (Radius)</span>
              <span className="text-emerald-400">+{localSettings.radius} km</span>
            </label>
            <input 
              type="range" 
              min={0} 
              max={150} 
              step={5}
              value={localSettings.radius}
              onChange={e => setLocalSettings({...localSettings, radius: Number(e.target.value)})}
              className="w-full accent-emerald-500"
            />
         </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">Zimmer (Min)</label>
            <select
              value={localSettings.minRooms}
              onChange={e => setLocalSettings({...localSettings, minRooms: Number(e.target.value)})}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none appearance-none"
            >
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8].map(num => (
                <option key={num} value={num}>
                  {num} {num >= 8 ? 'Zimmer oder mehr' : 'Zimmer'}
                </option>
              ))}
            </select>
          </div>
          <div>
             <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">Fläche m² (Min)</label>
            <input 
              type="number"
              value={localSettings.minSpace}
              onChange={e => setLocalSettings({...localSettings, minSpace: Number(e.target.value)})}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-700/50 pt-5 mt-2">
           <label className="flex items-center gap-3 cursor-pointer">
             <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${localSettings.provisionsfrei ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-800 border-slate-600'}`}>
                {localSettings.provisionsfrei && <svg className="w-4 h-4 text-slate-950" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
             </div>
             <div>
               <div className="text-sm font-bold text-white uppercase tracking-wider">Nur Provisionsfrei / Von Privat</div>
               <div className="text-xs text-slate-400">Blende Inserate mit offensichtlicher Maklerprovision aus.</div>
             </div>
             <input type="checkbox" className="hidden" checked={!!localSettings.provisionsfrei} onChange={e => setLocalSettings({...localSettings, provisionsfrei: e.target.checked})} />
           </label>
        </div>

        <div className="border-t border-slate-700/50 pt-5 mt-2">
           <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">Aktive Portale</label>
           <div className="grid grid-cols-2 gap-3">
             {['Kleinanzeigen', 'Immowelt', 'ImmoScout24', 'Immonet', 'Regional'].map((portal) => {
                const isActive = localSettings.activePortals?.includes(portal);
                const togglePortal = () => {
                  const current = localSettings.activePortals || [];
                  setLocalSettings({ ...localSettings, activePortals: isActive ? current.filter(p => p !== portal) : [...current, portal] });
                };
                return (
                  <label key={portal} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors cursor-pointer ${isActive ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-slate-600'}`}>
                      {isActive && <svg className="w-3 h-3 text-slate-950" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                    <span className="text-sm font-bold truncate">{portal}</span>
                    <input type="checkbox" className="hidden" checked={isActive} onChange={togglePortal} />
                  </label>
                );
             })}
           </div>
        </div>
      </div>
      </div>
      
      <div className="p-6 bg-slate-950 border-t border-slate-800 shrink-0">
        <button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg p-4 rounded-2xl w-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all">
          <Save className="w-5 h-5" /> Speichern & Suchen
        </button>
      </div>
    </div>
  );
};
