import React from 'react';
import { LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LogoutButton({ user }) {
  const handleLogout = () => {
    base44.auth.logout(window.location.href);
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/50 text-sm hover:text-amber-light hover:border-[rgba(201,145,58,0.4)] transition-colors"
    >
      <LogOut size={14} />
      Log Out
    </button>
  );
}