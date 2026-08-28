import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Map, Clock, Network, GitBranch, Upload, Shield, Search, Menu, X, Sparkles, Database, AlertCircle, Newspaper, CheckSquare, UserPlus, Share2, Brain } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReportProblemDialog from '@/components/ReportProblemDialog';
import InviteUserDialog from '@/components/InviteUserDialog';
import ShareTrialDialog from '@/components/ShareTrialDialog';
import NewsletterOptIn from '@/components/NewsletterOptIn';
import NotificationPopup from '@/components/NotificationPopup';
import BranchUpgradeForm from '@/components/BranchUpgradeForm';
import BranchTransferInvitation from '@/components/BranchTransferInvitation';
import LogoutButton from '@/components/LogoutButton';
import UploadAssistant from '@/components/UploadAssistant';
import PageHero from '@/components/PageHero';
import { useBranchRoot } from '@/hooks/useBranchRoot';

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Ancestors', path: '/ancestors', icon: Users },
  { label: 'Map', path: '/map', icon: Map },
  { label: 'Timeline', path: '/timeline', icon: Clock },
  { label: 'Family Tree', path: '/family-tree', icon: Network },
  { label: 'Branches', path: '/branches', icon: GitBranch },
  { label: 'Upload Event', path: '/upload', icon: Upload },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Dataset', path: '/archive-dataset', icon: Database },
  { label: 'Chronicle', path: '/newsletters', icon: Newspaper },
  { label: 'Trivia', path: '/quiz', icon: Brain },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareTrialOpen, setShareTrialOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [adminBranches, setAdminBranches] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { rootAncestorId, rootAncestor } = useBranchRoot();
  const branchRootPath = rootAncestorId ? `/ancestor/${rootAncestorId}` : '/';
  // Capitalise the surname in the title (birth-certificate format)
  const sidebarTitle = (() => {
    const name = rootAncestor?.full_name || user?.full_name || 'Jason Lewis FREDDI';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return [...parts.slice(0, -1), parts[parts.length - 1].toUpperCase()].join(' ');
    }
    return name.toUpperCase();
  })();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Branch.list().then(setAdminBranches).catch(() => {});
  }, []);

  const isBranchAdmin = (adminBranches || []).some(b => b.admin_user_id && user && b.admin_user_id === user.id);

  const isAdmin = user?.role === 'admin';

  const navItemsWithAdmin = [
    ...navItems,
    ...(isAdmin ? [{ label: 'Global Admin', path: '/admin', icon: Shield }] : []),
    ...(isBranchAdmin ? [{ label: 'Branch Admin', path: '/branch-admin', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-charcoal flex flex-col lg:flex-row">
      {/* Top bar - mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-charcoal/95 backdrop-blur-md border-b border-[rgba(201,145,58,0.15)] px-4 h-16 flex items-center justify-between">
        <Link to={branchRootPath} className="font-display text-lg text-gold tracking-wide">{sidebarTitle}</Link>
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
            <h1 className="font-display text-xl text-gold tracking-wide leading-tight">{sidebarTitle}</h1>
            <p className="font-display text-xs text-amber-light/70 tracking-widest uppercase mt-1">Present, Past, Future</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItemsWithAdmin.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isFeatured = item.path === '/upload';
            if (isFeatured) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold border border-transparent
                    ${isActive ? 'ring-2 ring-[#E8C97A] ring-offset-2 ring-offset-[#0D0B0A]' : 'hover:opacity-90'}
                  `}
                >
                  <Icon size={18} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            }
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

          {isAdmin && (
            <button
              onClick={() => { setSidebarOpen(false); setInviteOpen(true); }}
              className="flex items-center gap-3 px-4 py-3 mt-2 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.25)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors w-full"
            >
              <UserPlus size={18} />
              Invite New User
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setSidebarOpen(false); setShareTrialOpen(true); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.25)] text-amber-light text-sm font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors w-full"
            >
              <Share2 size={18} />
              Share 14-Day Trial
            </button>
          )}
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
              <button
                onClick={() => { setSidebarOpen(false); base44.auth.redirectToLogin(window.location.href); }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm font-semibold hover:bg-[rgba(201,145,58,0.08)] transition-colors w-full"
              >
                Login
              </button>
              <button
                onClick={() => { setSidebarOpen(false); base44.auth.redirectToLogin(window.location.href); }}
                className="flash-pulse flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity text-center leading-tight w-full"
              >
                <Sparkles size={16} />
                Become Your Own Ancestor
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 pt-16 lg:pt-0">
        {user && <NotificationPopup />}
        {user && <BranchTransferInvitation branches={adminBranches} user={user} onResponded={() => base44.entities.Branch.list().then(setAdminBranches).catch(() => {})} />}
        <main className="min-h-screen">
          {location.pathname !== '/' && <PageHero />}
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

      <UploadAssistant rootAncestor={rootAncestor} />

      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} user={user} />
      <ShareTrialDialog open={shareTrialOpen} onClose={() => setShareTrialOpen(false)} user={user} />
    </div>
  );
}