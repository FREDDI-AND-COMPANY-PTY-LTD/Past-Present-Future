import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Map, Clock, Network, GitBranch, Upload, Shield, Search, Menu, X, Sparkles, Database, Inbox, AlertCircle, Newspaper } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReportProblemDialog from '@/components/ReportProblemDialog';
import NewsletterOptIn from '@/components/NewsletterOptIn';
import NotificationPopup from '@/components/NotificationPopup';
import BranchUpgradeForm from '@/components/BranchUpgradeForm';
import LogoutButton from '@/components/LogoutButton';
import { useBranchRoot } from '@/hooks/useBranchRoot';

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Ancestors', path: '/ancestors', icon: Users },
  { label: 'Map', path: '/map', icon: Map },
  { label: 'Timeline', path: '/timeline', icon: Clock },
  { label: 'Family Tree', path: '/family-tree', icon: Network },
  { label: 'Branches', path: '/branches', icon: GitBranch },
  { label: 'Upload Event', path: '/upload', icon: Upload },
  { label: 'Dataset', path: '/archive-dataset', icon: Database },
  { label: 'Chronicle', path: '/newsletters', icon: Newspaper },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { rootAncestorId } = useBranchRoot();
  const branchRootPath = rootAncestorId ? `/ancestor/${rootAncestorId}` : '/';

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  const navItemsWithAdmin = isAdmin
    ? [...navItems, { label: 'Admin', path: '/admin', icon: Shield }, { label: 'Admin Inbox', path: '/admin-inbox', icon: Inbox }]
    : navItems;

  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      {/* Top bar - mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-charcoal/95 backdrop-blur-md border-b border-[rgba(201,145,58,0.15)] px-4 h-16 flex items-center justify-between">
        <Link to={branchRootPath} className="font-display text-lg text-gold tracking-wide">Jason Lewis FREDDI</Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-parchment p-2">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-charcoal border-r border-[rgba(201,145,58,0.15)]
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-[rgba(201,145,58,0.15)]">
          <Link to={branchRootPath} onClick={() => setSidebarOpen(false)} className="block">
            <h1 className="font-display text-xl text-gold tracking-wide leading-tight">Jason Lewis FREDDI</h1>
            <p className="font-display text-xs text-amber-light/70 tracking-widest uppercase mt-1">Present, Past, Future</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItemsWithAdmin.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-[rgba(201,145,58,0.12)] text-gold border border-[rgba(201,145,58,0.25)]'
                    : 'text-parchment/60 hover:text-parchment hover:bg-[rgba(201,145,58,0.06)] border border-transparent'
                  }
                `}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[rgba(201,145,58,0.15)]">
          {user ? (
            <>
              <div className="mb-3 px-4 py-2 text-xs text-parchment/50">
                Signed in as<br />
                <span className="text-amber-light">{user.full_name || user.email}</span>
              </div>
              <div className="mb-3">
                <NewsletterOptIn user={user} onUpdate={setUser} />
              </div>
              <div className="mb-3">
                <BranchUpgradeForm user={user} onUpdate={setUser} />
              </div>
              <LogoutButton user={user} />
            </>
          ) : (
            <div className="space-y-2">
              <Link
                to="/login"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-semibold hover:bg-[rgba(201,145,58,0.08)] transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setSidebarOpen(false)}
                className="flash-pulse flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity text-center leading-tight"
              >
                <Sparkles size={16} />
                Become Your Own Ancestor
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        {user && <NotificationPopup />}
        <main className="min-h-screen">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-[rgba(201,145,58,0.15)] px-6 lg:px-12 py-8 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg text-gold">Jason Lewis FREDDI, Present, Past, Future</p>
              <p className="text-xs text-parchment/40 mt-1">A private family history — preserved for generations</p>
            </div>
            <div className="flex items-center gap-3">
              <ReportProblemDialog>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/60 text-sm hover:text-amber-light hover:border-[rgba(201,145,58,0.4)] transition-colors">
                  <AlertCircle size={14} />
                  Contact Admin
                </button>
              </ReportProblemDialog>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}