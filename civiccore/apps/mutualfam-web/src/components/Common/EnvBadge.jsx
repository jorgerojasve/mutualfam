import React from 'react';
import { getEnvironmentConfig } from '../../utils/env';

/**
 * Pastilla/Badge indicadora del entorno de ejecución.
 * Solo se muestra si NO es producción, o con modo showProd=true si se desea.
 */
export function EnvBadge({ size = 'medium', showProd = false, className = '' }) {
  const config = getEnvironmentConfig();

  if (config.isProd && !showProd) {
    return null;
  }

  const isSmall = size === 'small';
  const padding = isSmall ? '0.15rem 0.5rem' : '0.25rem 0.75rem';
  const fontSize = isSmall ? '0.7rem' : '0.75rem';

  return (
    <span
      className={`env-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRadius: '9999px',
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        boxShadow: `0 0 10px ${config.bgColor}`,
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          boxShadow: `0 0 6px ${config.color}`,
        }}
      />
      {config.badgeText || config.label}
    </span>
  );
}

/**
 * Cintillo superior global para alertar al usuario cuando esté en QA o Dev.
 */
export function EnvTopBanner() {
  const config = getEnvironmentConfig();

  if (config.isProd || !config.bannerText) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: config.bgColor,
        borderBottom: `1px solid ${config.borderColor}`,
        color: config.color,
        padding: '0.45rem 1rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        textAlign: 'center',
        letterSpacing: '0.02em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        zIndex: 50,
      }}
    >
      <span>{config.bannerText}</span>
    </div>
  );
}

export default EnvBadge;
