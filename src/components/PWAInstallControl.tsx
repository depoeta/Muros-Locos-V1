/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Control de instalación PWA (Android, Escritorio e iOS Safari) + Indicador de Modo Offline
 */

import React, { useEffect, useState } from 'react';
import { sounds } from '../game/murosLocosEngine';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Almacenar evento globalmente por si se dispara antes de montar el componente
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const syncPrompt = () => {
      setDeferredPrompt(globalDeferredPrompt);
      checkStandalone();
    };

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    promptListeners.add(syncPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', checkStandalone);

    return () => {
      promptListeners.delete(syncPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      media.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = globalDeferredPrompt || deferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="p-3 rounded-2xl bg-[#d3f9d8] border-2 border-[#2b2140] flex items-center justify-between gap-2 text-xs font-black text-[#134e20]">
          <span>📲 App instalada en tu dispositivo</span>
          <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-[#2b2140]">
            Lista sin internet
          </span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    sounds.playClick();
    if (isInstallable) {
      const ok = await install();
      if (ok) onInstalled?.();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (!isInstallable && !isIOS) {
    if (variant === 'card') {
      return (
        <div className="p-3 rounded-2xl bg-white border-2 border-[#2b2140] flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="font-extrabold text-[#2b2140] block">
              📴 Modo Offline Activado
            </span>
            <span className="text-[11px] font-medium text-[#86542d] block leading-tight">
              Los archivos del juego ya se guardan en tu navegador para jugar Local, Bots y Torneo sin internet.
            </span>
          </div>
          <span className="text-lg shrink-0">✅</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {variant === 'card' ? (
        <div className="p-3 rounded-2xl bg-[#fff3bf] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">📲</span>
            <div className="min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-[#2b2140] block truncate">
                Instalar Muros Locos (App)
              </span>
              <span className="text-[11px] font-semibold text-[#5c3c00] block leading-tight">
                Juega a pantalla completa y sin internet cuando quieras
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="py-1.5 px-3 rounded-xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] active:translate-y-0.5 font-black text-xs cursor-pointer shrink-0"
          >
            {isIOS ? 'Cómo instalar' : 'Instalar'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="py-1 px-2.5 rounded-2xl bg-[#51cf66] hover:bg-[#40c057] text-[#134e20] border-2 border-[#2b2140] shadow-[0_3px_0_#2b2140] active:translate-y-0.5 font-black text-xs cursor-pointer flex items-center gap-1 transition-all"
          title="Instalar juego como aplicación para jugar sin internet"
        >
          <span>📲</span>
          <span>Instalar App</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-sm bg-[#fff8e7] border-4 border-[#2b2140] rounded-3xl p-5 shadow-[0_10px_0_#2b2140,0_20px_30px_rgba(0,0,0,0.35)] text-left">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-[#2b2140]/15">
              <h3 className="text-base font-black text-[#2b2140] flex items-center gap-2">
                <span>📲</span> Instalar en iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-7 h-7 rounded-full bg-white border-2 border-[#2b2140] text-xs font-black text-[#2b2140] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <ol className="text-xs font-bold text-[#593922] space-y-2 mb-4 list-decimal list-inside bg-white p-3 rounded-2xl border-2 border-[#2b2140]">
              <li>
                Toca el botón <strong className="text-[#2b2140]">Compartir</strong> en la barra de Safari.
              </li>
              <li>
                Desliza hacia abajo y elige{' '}
                <strong className="text-[#2b2140]">Añadir a pantalla de inicio</strong>.
              </li>
              <li>
                Pulsa <strong className="text-[#2b2140]">Añadir</strong> para jugar incluso sin internet.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-xl font-black text-xs bg-[#51cf66] text-[#134e20] border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] cursor-pointer"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface OfflineIndicatorProps {
  compact?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ compact = false }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  if (compact) {
    return (
      <div
        className="fixed bottom-3 left-3 z-[65] flex items-center justify-center p-1.5 rounded-full bg-[#2b2140]/90 border-2 border-[#2b2140] shadow-[0_2px_0_#2b2140] transition-all"
        title="Sin conexión a internet (Modo Offline)"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#fa5252] border border-white animate-pulse shrink-0" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[65] flex items-center gap-2 rounded-2xl bg-[#ffd43b] text-[#2b2140] border-2 border-[#2b2140] px-3 py-1.5 text-[11px] font-black shadow-[0_4px_0_#2b2140] transition-all">
      <span className="h-2.5 w-2.5 rounded-full bg-[#e67700] border border-[#2b2140] animate-pulse shrink-0" />
      <span>📴 Modo Sin Internet · Local, Bots y Torneo disponibles</span>
    </div>
  );
};
