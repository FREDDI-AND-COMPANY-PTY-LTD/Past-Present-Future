import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LogoutButton({ user }) {
  const [backingUp, setBackingUp] = useState(false);

  const handleLogout = async () => {
    // Trigger archive backup before logout if user is a branch member with a cloud folder
    if (user?.is_branch_member || user?.cloud_folder_address) {
      setBackingUp(true);
      try {
        await base44.functions.invoke('fullArchiveBackup', {});
      } catch (e) {
        // Backup failure shouldn't block logout
      }
      setBackingUp(false);
    }
    base44.auth.logout(window.location.href);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={backingUp}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/50 text-sm hover:text-amber-light hover:border-[rgba(201,145,58,0.4)] transition-colors disabled:opacity-50"
    >
      {backingUp ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Backing up archive...
        </>
      ) : (
        <>
          <LogOut size={14} />
          Log Out
        </>
      )}
    </button>
  );
}