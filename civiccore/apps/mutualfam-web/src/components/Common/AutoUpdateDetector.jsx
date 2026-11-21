import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { checkForWebUpdate, applyWebUpdate } from '../../utils/versionCheck';

/**
 * Componente detector automático de nuevas versiones para Web y PWA (iOS/Android/Desktop).
 * - Monitorea en segundo plano periódicamente (cada 60s).
 * - Monitorea inmediatamente cuando el usuario regresa a la pestaña/app (visibilitychange / focus).
 * - Monitorea en cambios de ruta de navegación SPA.
 * - Captura errores de importación dinámica de Vite (chunks obsoletos tras nuevo deploy) y recarga limpia.
 * - Muestra un banner discreto antes de actualizar automáticamente para una experiencia fluida.
 */
export default function AutoUpdateDetector() {
  const [newVersion, setNewVersion] = useState(null);
  const isUpdatingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const location = useLocation();

  const isUserTyping = () => {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || active.isContentEditable;
  };

  const triggerUpdate = (version) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    setNewVersion(version);

    // Si el usuario está escribiendo en un formulario, esperar un poco para no interrumpirlo abruptamente
    const delay = isUserTyping() ? 3000 : 1200;
    setTimeout(() => {
      applyWebUpdate(version);
    }, delay);
  };

  const checkVersion = async () => {
    if (isUpdatingRef.current) return;
    const now = Date.now();
    // Evitar llamadas excesivas (mínimo 15s entre consultas)
    if (now - lastCheckRef.current < 15000) return;
    lastCheckRef.current = now;

    const res = await checkForWebUpdate();
    if (res.hasUpdate && res.latestVersion) {
      triggerUpdate(res.latestVersion);
    }
  };

  useEffect(() => {
    // 1. Verificación inicial al cargar
    checkVersion();

    // 2. Intervalo periódico cada 60 segundos
    const timer = setInterval(() => {
      checkVersion();
    }, 60000);

    // 3. Al volver a la pestaña o desbloquear pantalla (clave para iOS Safari / PWA)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    const handleFocus = () => {
      checkVersion();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    // 4. Capturar errores de chunks desfasados de Vite
    const handleError = (event) => {
      const msg = event?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        console.warn('Vite chunk out-of-date detected, auto-updating...');
        applyWebUpdate();
      }
    };

    const handleUnhandledRejection = (event) => {
      const msg = event?.reason?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        console.warn('Vite chunk rejection detected, auto-updating...');
        applyWebUpdate();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 5. Verificación en cambios de ruta
  useEffect(() => {
    checkVersion();
  }, [location.pathname]);

  if (!newVersion) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        backgroundColor: '#059669',
        color: '#ffffff',
        padding: '0.65rem 1rem',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.3s ease',
      }}
    >
      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>🔄</span>
      <span>
        Nueva versión detectada ({newVersion ? `v${newVersion}` : 'actualización'}). Actualizando automáticamente...
      </span>
    </div>
  );
}
