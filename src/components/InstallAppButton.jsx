import React, { useState, useEffect } from 'react';
import { Download, Check } from 'lucide-react';

/**
 * PWA "Install App" button for the footer. Listens for the browser's
 * beforeinstallprompt event, and when clicked triggers the native install
 * prompt. Hides once the app is already installed (running standalone).
 */
export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (installed) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(201,145,58,0.2)] text-parchment/40 text-xs">
        <Check size={14} /> App installed
      </span>
    );
  }

  if (!deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      <Download size={14} /> Install App
    </button>
  );
}