import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Home, Users, Map, Clock, Newspaper, Loader2, Hourglass, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import GuestHome from '@/components/guest/GuestHome';
import GuestAncestors from '@/components/guest/GuestAncestors';
import GuestMap from '@/components/guest/GuestMap';
import GuestTimeline from '@/components/guest/GuestTimeline';
import GuestChronicle from '@/components/guest/GuestChronicle';
import GuestContentDetail from '@/components/guest/GuestContentDetail';
import GuestPageHero from '@/components/guest/GuestPageHero';

const NAV = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'ancestors', label: 'Ancestors', icon: Users },
  { key: 'map', label: 'Map', icon: Map },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'chronicle', label: 'Chronicle', icon: Newspaper },
];

const PAGE_TITLES = {
  ancestors: 'Ancestors',
  map: 'Interactive Map',
  timeline: 'Timeline',
  chronicle: 'Chronicle',
};

export default function GuestViewer() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [invalid, setInvalid] = useState(null);
  const [view, setView] = useState('home');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    base44.functions.invoke('loadGuestArchive', { token })
      .then((res) => {
        const d = res.data || res;
        if (d.valid) setData(d);
        else setInvalid(d.reason || 'This trial link is no longer valid.');
      })
      .catch(() => setInvalid('This trial link could not be verified.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <Loader2 size={28} className="text-gold animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-6">
        <div className="aged-card rounded-xl p-10 text-center max-w-md">
          <Hourglass size={36} className="text-gold/40 mx-auto mb-3" />
          <h1 className="font-display text-2xl text-parchment mb-2">Trial unavailable</h1>
          <p className="text-parchment/50 text-sm">{invalid}</p>
        </div>
      </div>
    );
  }

  const archive = data.archive || {};
  const items = archive.contentItems || [];
  const ancestors = archive.ancestors || [];
  const newsletters = archive.newsletters || [];
  const relatedOf = (item) => (item ? items.filter((i) => i.parent_content_item_id === item.id) : []);
  const navigate = (v) => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="min-h-screen bg-charcoal flex flex-col lg:flex-row">
      {/* Sidebar — mirrors the app's Layout sidebar */}
      <aside className="lg:sticky lg:top-0 lg:h-screen w-full lg:w-64 bg-charcoal border-b lg:border-b-0 lg:border-r border-[rgba(201,145,58,0.15)] flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-[rgba(201,145,58,0.15)]">
          <h1 className="font-display text-xl text-gold leading-tight">Freddi Family Archive</h1>
          <p className="font-display text-xs text-amber-light/70 tracking-widest uppercase mt-1">Present, Past, Future</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-x-auto lg:overflow-x-visible flex lg:flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button key={item.key} onClick={() => navigate(item.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${active ? 'bg-[rgba(201,145,58,0.12)] text-gold border border-[rgba(201,145,58,0.25)]' : 'text-parchment/60 hover:text-parchment hover:bg-[rgba(201,145,58,0.06)] border border-transparent'}`}>
                <Icon size={18} /><span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[rgba(201,145,58,0.15)]">
          <div className="aged-card rounded-lg p-3 flex items-start gap-2">
            <Eye size={16} className="text-gold mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="text-amber-light font-medium flex items-center gap-1"><Hourglass size={11} /> 14-day trial</p>
              <p className="text-parchment/50 mt-0.5">Viewer: {data.viewer_email}</p>
              <p className="text-parchment/50">{data.days_left} day{data.days_left === 1 ? '' : 's'} remaining</p>
              <p className="text-gold/60 mt-1">Read-only access</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area — mirrors the app's Layout: PageHero on non-Home, content, footer */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1">
          {view === 'home' ? (
            <GuestHome items={items} ancestors={ancestors} onSelect={setSelectedItem} onNavigate={navigate} />
          ) : (
            <>
              <GuestPageHero items={items} />
              <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-8">
                  {(() => {
                    const NavIcon = NAV.find((n) => n.key === view)?.icon || Home;
                    return (
                      <div className="w-11 h-11 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
                        <NavIcon size={22} className="text-gold" />
                      </div>
                    );
                  })()}
                  <h1 className="font-display text-3xl text-parchment">{PAGE_TITLES[view]}</h1>
                </div>
                {view === 'ancestors' && <GuestAncestors ancestors={ancestors} contentItems={items} onSelectContent={setSelectedItem} />}
                {view === 'map' && <GuestMap items={items} onSelect={setSelectedItem} />}
                {view === 'timeline' && <GuestTimeline items={items} onSelect={setSelectedItem} />}
                {view === 'chronicle' && <GuestChronicle newsletters={newsletters} />}
              </div>
            </>
          )}
        </main>

        {/* Footer — mirrors the app's Layout footer */}
        <footer className="border-t border-[rgba(201,145,58,0.15)] px-6 lg:px-12 py-8 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg text-gold">Freddi Family Archive</p>
              <p className="text-xs text-parchment/40 mt-1">A private family history — preserved for generations</p>
            </div>
            <p className="text-xs text-parchment/40 flex items-center gap-1.5">
              <Eye size={12} className="text-gold/50" /> Guest preview · read-only
            </p>
          </div>
        </footer>
      </div>

      {selectedItem && (
        <GuestContentDetail item={selectedItem} ancestors={ancestors} relatedItems={relatedOf(selectedItem)} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}