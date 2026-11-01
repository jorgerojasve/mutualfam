import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Estado vacío para iOS / Web cuando no hay conexión de red.
 * Asegura al usuario que sus datos y préstamos no han sido eliminados.
 */
export function OfflineEmptyState({
  title = "Sin conexión de red",
  message = "No pudimos cargar los datos de las mutuales y préstamos. Tus datos están seguros y no se han eliminado. Por favor, intenta de nuevo cuando tengas conexión.",
  onRetry,
  loading = false,
  style = {}
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1.5rem',
      margin: '1.5rem auto',
      maxWidth: '440px',
      backgroundColor: 'rgba(30, 41, 59, 0.75)',
      borderRadius: '1.25rem',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      ...style
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        border: '1px solid rgba(251, 191, 36, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem auto',
        color: '#fbbf24'
      }}>
        <WifiOff size={32} />
      </div>
      
      <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.6rem' }}>
        {title}
      </h3>
      
      <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Reintentando...' : 'Reintentar conexión'}
        </button>
      )}
    </div>
  );
}

/**
 * Cintillo informativo cuando se muestran datos locales/cacheados sin conexión de red en iOS / Web.
 */
export function OfflineNoticeBanner({
  message = "Sin conexión de red · Mostrando datos guardados",
  onRetry,
  loading = false,
  style = {}
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.35)',
      borderRadius: '10px',
      padding: '8px 14px',
      marginBottom: '1rem',
      ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <WifiOff size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600' }}>
          {message}
        </span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
            color: '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Reintentar</span>
        </button>
      )}
    </div>
  );
}

export default OfflineEmptyState;
