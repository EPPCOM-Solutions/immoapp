import { Home, Heart, User } from 'lucide-react';
import React from 'react';

interface BottomNavProps {
  currentTab: 'discover' | 'saved' | 'profile';
  setTab: (tab: 'discover' | 'saved' | 'profile') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 glass pb-safe pt-2 px-6 flex justify-between items-center z-50 rounded-t-3xl border-b-0 pb-6">
      <button 
        onClick={() => setTab('discover')}
        className={`flex flex-col items-center p-2 transition-colors ${currentTab === 'discover' ? 'text-orange-400' : 'text-stone-400'}`}
      >
        <Home className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-medium tracking-wider uppercase">Entdecken</span>
      </button>
      
      <button 
        onClick={() => setTab('saved')}
        className={`flex flex-col items-center p-2 transition-colors relative ${currentTab === 'saved' ? 'text-pink-400' : 'text-stone-400'}`}
      >
        <Heart className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-medium tracking-wider uppercase">Gemerkt</span>
      </button>

      <button 
        onClick={() => setTab('profile')}
        className={`flex flex-col items-center p-2 transition-colors ${currentTab === 'profile' ? 'text-blue-400' : 'text-stone-400'}`}
      >
        <User className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-medium tracking-wider uppercase">Tresor</span>
      </button>
    </div>
  );
};
