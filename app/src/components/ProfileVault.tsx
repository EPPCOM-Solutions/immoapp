"use client";

import React, { useState } from 'react';
import { UserProfile } from '../types/property';
import { ShieldCheck, Save } from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
}

export const ProfileVault: React.FC<Props> = ({ profile, setProfile }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto hide-scrollbar pb-24">
        <div className="flex items-center justify-between mb-6 pt-4">
          <h1 className="text-3xl font-black text-white">Tresor</h1>
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>

        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-2xl mb-8 flex gap-4">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-emerald-400 font-bold text-sm mb-1">DSGVO-Konform</h3>
            <p className="text-emerald-100/70 text-xs leading-relaxed">
              Deine Daten für die Ein-Klick-Bewerbung bleiben **ausschließlich auf deinem Gerät** gespeichert.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2 block">Vollständiger Name</label>
            <input 
              type="text" 
              value={profile.name}
              onChange={e => setProfile({...profile, name: e.target.value})}
              className="w-full bg-slate-800/50 border border-slate-700 focus:border-emerald-500 rounded-xl p-3.5 text-white outline-none transition-all"
              placeholder="Max Mustermann"
            />
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2 block">E-Mail Adresse</label>
            <input 
              type="email" 
              value={profile.email}
              onChange={e => setProfile({...profile, email: e.target.value})}
              className="w-full bg-slate-800/50 border border-slate-700 focus:border-emerald-500 rounded-xl p-3.5 text-white outline-none transition-all"
              placeholder="max@beispiel.de"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2 block">Netto (mtl.)</label>
              <div className="relative mb-2">
                <input 
                  type="number" 
                  value={profile.income}
                  onChange={e => setProfile({...profile, income: Number(e.target.value)})}
                  className="w-full bg-slate-800/50 border border-slate-700 focus:border-emerald-500 rounded-xl p-3.5 pl-10 text-white outline-none transition-all"
                />
                <span className="absolute left-3.5 top-3.5 text-slate-400 font-bold">€</span>
              </div>
              <input 
                type="range" min="0" max="15000" step="100" 
                value={profile.income} 
                onChange={e => setProfile({...profile, income: Number(e.target.value)})} 
                className="w-full accent-emerald-500" 
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2 block">Personen</label>
              <input 
                type="number" 
                value={profile.householdSize}
                onChange={e => setProfile({...profile, householdSize: Number(e.target.value)})}
                className="w-full bg-slate-800/50 border border-slate-700 focus:border-emerald-500 rounded-xl p-3.5 text-white outline-none transition-all mb-2"
              />
              <input 
                type="range" min="1" max="10" step="1" 
                value={profile.householdSize} 
                onChange={e => setProfile({...profile, householdSize: Number(e.target.value)})} 
                className="w-full accent-emerald-500" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2 block">Standard-Anschreiben</label>
            <textarea 
              value={profile.applicationText}
              onChange={e => setProfile({...profile, applicationText: e.target.value})}
              rows={4}
              className="w-full bg-slate-800/50 border border-slate-700 focus:border-emerald-500 rounded-xl p-3.5 text-white outline-none transition-all resize-none text-sm"
              placeholder="Guten Tag, ich interessiere mich sehr für Ihr Objekt..."
            />
          </div>

          <div className="pt-4 border-t border-slate-700/50">
            <h3 className="text-emerald-400 font-bold text-sm mb-4">Verknüpfte Portale für 1-Klick-Bewerbung</h3>
            
            {['Kleinanzeigen', 'ImmoScout24', 'Immowelt'].map(portal => {
              const key = portal.toLowerCase();
              const portalData = profile.portalLogins?.[key] || { username: '', password: '' };
              
              return (
                <div key={portal} className="mb-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-300 block">{portal} Login</label>
                    <button 
                      onClick={() => alert(`${portal} Logindaten werden geprüft... (MOCK-Erfolgreich)`)}
                      className="px-3 py-1 bg-slate-700 hover:bg-emerald-500 hover:text-slate-900 border border-slate-600 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                    >
                      Testen
                    </button>
                  </div>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={portalData.username || ''}
                      onChange={e => {
                        const newLogins = { ...profile.portalLogins, [key]: { ...portalData, username: e.target.value } };
                        setProfile({...profile, portalLogins: newLogins});
                      }}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-emerald-500 rounded-lg p-3 text-sm text-white outline-none transition-all"
                      placeholder="E-Mail oder Benutzername"
                    />
                    <input 
                      type="password" 
                      value={portalData.password || ''}
                      onChange={e => {
                        const newLogins = { ...profile.portalLogins, [key]: { ...portalData, password: e.target.value } };
                        setProfile({...profile, portalLogins: newLogins});
                      }}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-emerald-500 rounded-lg p-3 text-sm text-white outline-none transition-all"
                      placeholder="Passwort"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-slate-950 border-t border-slate-800 shrink-0">
        <button 
          onClick={handleSave}
          className={`w-full p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
        >
          <Save className="w-5 h-5" />
          {saved ? 'Lokal Gespeichert!' : 'Daten lokal speichern'}
        </button>
      </div>
    </div>
  );
};
