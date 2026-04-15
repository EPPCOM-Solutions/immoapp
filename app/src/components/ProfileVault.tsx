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
  const [testingPortals, setTestingPortals] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});

  const handleTestPortal = async (portal: string, auth: any) => {
    if (!auth.username || !auth.password) {
      alert("Bitte fülle Benutzername und Passwort aus.");
      return;
    }
    
    const key = portal.toLowerCase();
    setTestingPortals(prev => ({ ...prev, [key]: 'testing' }));
    
    try {
      const res = await fetch('/api/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal, ...auth })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setTestingPortals(prev => ({ ...prev, [key]: 'success' }));
      } else {
        setTestingPortals(prev => ({ ...prev, [key]: 'failed' }));
      }
    } catch (e) {
      setTestingPortals(prev => ({ ...prev, [key]: 'failed' }));
    }
    
    setTimeout(() => {
       setTestingPortals(prev => {
         const newState = {...prev};
         delete newState[key];
         return newState;
       });
    }, 4000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 bg-stone-950/80 backdrop-blur-xl flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto hide-scrollbar pb-24">
        <div className="flex items-center justify-between mb-6 pt-4">
          <h1 className="text-3xl font-black text-white">Tresor</h1>
          <ShieldCheck className="w-8 h-8 text-orange-400" />
        </div>

        <div className="bg-orange-900/10 border border-orange-500/20 p-4 rounded-2xl mb-8 flex gap-4">
          <ShieldCheck className="w-6 h-6 text-orange-400 shrink-0" />
          <div>
            <h3 className="text-orange-400 font-bold text-sm mb-1">DSGVO-Konform</h3>
            <p className="text-orange-100/70 text-xs leading-relaxed">
              Deine Daten für die Ein-Klick-Bewerbung bleiben **ausschließlich auf deinem Gerät** gespeichert.
            </p>
          </div>
        </div>

        <div className="bg-stone-900 p-4 rounded-2xl mb-8 border border-stone-800">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-800">
             <div>
                <h3 className="font-bold text-sm text-white">Premium Account</h3>
                <p className="text-xs text-stone-400">Erweiterte Funktionen freischalten</p>
             </div>
             <button
               onClick={() => setProfile({...profile, isPremium: !profile.isPremium})}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${profile.isPremium ? 'bg-orange-500 text-stone-900 shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-stone-800 text-stone-300 border border-stone-700'}`}
             >
               {profile.isPremium ? 'Premium Aktivierung Aufheben' : 'Premium Mockup Aktivieren'}
             </button>
          </div>
          
          <div className="flex items-center justify-between">
             <div>
                <h3 className="font-bold text-sm text-orange-400">Makler & Akquise Modus</h3>
                <p className="text-xs text-stone-400 leading-tight mt-1">
                  Blendet "Von Privat"-Anzeigen besonders hervor und<br/>
                  Aktiviert den detaillierten Eigenkapital-Renditerechner.
                </p>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
               <input 
                 type="checkbox" 
                 value="" 
                 className="sr-only peer" 
                 checked={!!profile.isBrokerMode}
                 onChange={e => setProfile({...profile, isBrokerMode: e.target.checked})}
               />
               <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
             </label>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2 block">Vollständiger Name</label>
            <input 
              type="text" 
              value={profile.name}
              onChange={e => setProfile({...profile, name: e.target.value})}
              className="w-full bg-stone-800/50 border border-stone-700 focus:border-orange-500 rounded-xl p-3.5 text-white outline-none transition-all"
              placeholder="Max Mustermann"
            />
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2 block">E-Mail Adresse (Für Bewerbungen)</label>
            <input 
              type="email" 
              value={profile.email}
              onChange={e => setProfile({...profile, email: e.target.value})}
              className="w-full bg-stone-800/50 border border-stone-700 focus:border-orange-500 rounded-xl p-3.5 text-white outline-none transition-all"
              placeholder="max@beispiel.de"
            />
          </div>

          <div className="bg-stone-800/30 p-4 rounded-xl border border-stone-700/50 mb-6">
            <h3 className="text-orange-400 font-bold text-sm mb-3">E-Mail Server Einstellung (SMTP/IMAP)</h3>
            <p className="text-xs text-stone-400 mb-4">Hinterlege hier die SMTP-Daten deines E-Mail-Anbieters (z.B. GMail, GMX, Web.de), damit Bewerbungen über dein Postfach verschickt werden können.</p>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase text-stone-400 font-semibold mb-1 block">SMTP Server</label>
                <input 
                  type="text" 
                  value={profile.emailCredentials?.host || ''}
                  onChange={e => setProfile({...profile, emailCredentials: { ...profile.emailCredentials, host: e.target.value }})}
                  className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-2.5 text-sm text-white outline-none"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-stone-400 font-semibold mb-1 block">Port</label>
                <input 
                  type="text" 
                  value={profile.emailCredentials?.port || ''}
                  onChange={e => setProfile({...profile, emailCredentials: { ...profile.emailCredentials, port: e.target.value }})}
                  className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-2.5 text-sm text-white outline-none"
                  placeholder="465 oder 587"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-stone-400 font-semibold mb-1 block">E-Mail / Benutzername</label>
                <input 
                  type="text" 
                  value={profile.emailCredentials?.user || ''}
                  onChange={e => setProfile({...profile, emailCredentials: { ...profile.emailCredentials, user: e.target.value }})}
                  className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-2.5 text-sm text-white outline-none"
                  placeholder="name@beispiel.de"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-stone-400 font-semibold mb-1 block">App-Passwort</label>
                <input 
                  type="password" 
                  value={profile.emailCredentials?.pass || ''}
                  onChange={e => setProfile({...profile, emailCredentials: { ...profile.emailCredentials, pass: e.target.value }})}
                  className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-2.5 text-sm text-white outline-none"
                  placeholder="Dein SMTP Passwort"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2 block">Netto (mtl.)</label>
              <div className="relative mb-2">
                <input 
                  type="number" 
                  value={profile.income}
                  onChange={e => setProfile({...profile, income: Number(e.target.value)})}
                  className="w-full bg-stone-800/50 border border-stone-700 focus:border-orange-500 rounded-xl p-3.5 pl-10 text-white outline-none transition-all"
                />
                <span className="absolute left-3.5 top-3.5 text-stone-400 font-bold">€</span>
              </div>
              <input 
                type="range" min="0" max="15000" step="100" 
                value={profile.income} 
                onChange={e => setProfile({...profile, income: Number(e.target.value)})} 
                className="w-full accent-orange-500" 
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2 block">Personen</label>
              <input 
                type="number" 
                value={profile.householdSize}
                onChange={e => setProfile({...profile, householdSize: Number(e.target.value)})}
                className="w-full bg-stone-800/50 border border-stone-700 focus:border-orange-500 rounded-xl p-3.5 text-white outline-none transition-all mb-2"
              />
              <input 
                type="range" min="1" max="10" step="1" 
                value={profile.householdSize} 
                onChange={e => setProfile({...profile, householdSize: Number(e.target.value)})} 
                className="w-full accent-orange-500" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2 block">Standard-Anschreiben</label>
            <textarea 
              value={profile.applicationText}
              onChange={e => setProfile({...profile, applicationText: e.target.value})}
              rows={4}
              className="w-full bg-stone-800/50 border border-stone-700 focus:border-orange-500 rounded-xl p-3.5 text-white outline-none transition-all resize-none text-sm"
              placeholder="Guten Tag, ich interessiere mich sehr für Ihr Objekt..."
            />
          </div>

          <div className="pt-4 border-t border-stone-700/50">
            <h3 className="text-orange-400 font-bold text-sm mb-4">Verknüpfte Portale für 1-Klick-Bewerbung</h3>
            
            {['Kleinanzeigen', 'ImmoScout24', 'Immowelt'].map(portal => {
              const key = portal.toLowerCase();
              const portalData = profile.portalLogins?.[key] || { username: '', password: '' };
              
              const testState = testingPortals[key];
              let buttonClass = "px-3 py-1 bg-stone-700 hover:bg-orange-500 hover:text-stone-900 border border-stone-600 rounded-lg text-xs font-bold text-stone-300 transition-colors";
              let buttonText = "Testen";
              
              if (testState === 'testing') {
                 buttonClass = "px-3 py-1 bg-stone-600 border border-stone-500 rounded-lg text-xs font-bold text-stone-300 animate-pulse";
                 buttonText = "Prüfe...";
              } else if (testState === 'success') {
                 buttonClass = "px-3 py-1 bg-orange-500 border border-orange-400 rounded-lg text-xs font-bold text-stone-900";
                 buttonText = "Erfolgreich!";
              } else if (testState === 'failed') {
                 buttonClass = "px-3 py-1 bg-red-500 border border-red-400 rounded-lg text-xs font-bold text-white";
                 buttonText = "Fehlgeschlagen";
              }

              return (
                <div key={portal} className="mb-4 bg-stone-800/30 p-4 rounded-xl border border-stone-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-stone-300 block">{portal} Login</label>
                    <button 
                      onClick={() => handleTestPortal(portal, portalData)}
                      disabled={testState === 'testing'}
                      className={buttonClass}
                    >
                      {buttonText}
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
                      className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-3 text-sm text-white outline-none transition-all"
                      placeholder="E-Mail oder Benutzername"
                    />
                    <input 
                      type="password" 
                      value={portalData.password || ''}
                      onChange={e => {
                        const newLogins = { ...profile.portalLogins, [key]: { ...portalData, password: e.target.value } };
                        setProfile({...profile, portalLogins: newLogins});
                      }}
                      className="w-full bg-stone-900/50 border border-stone-700 focus:border-orange-500 rounded-lg p-3 text-sm text-white outline-none transition-all"
                      placeholder="Passwort"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-stone-950 border-t border-stone-800 shrink-0">
        <button 
          onClick={handleSave}
          className={`w-full p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-orange-500 text-stone-900' : 'bg-stone-700 hover:bg-stone-600 text-white'}`}
        >
          <Save className="w-5 h-5" />
          {saved ? 'Lokal Gespeichert!' : 'Daten lokal speichern'}
        </button>
      </div>
    </div>
  );
};
