import React, { useState } from 'react';

export default function CashDeliveryCard({
  data,
  montoUsd,
  recipientName,
}) {
  const [copiedField, setCopiedField] = useState(null);

  if (!data || typeof data !== 'object') {
    return (
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '12px',
        color: '#f87171',
        fontSize: '0.85rem'
      }}>
        No se encontraron datos de entrega en efectivo configurados.
      </div>
    );
  }

  const telefono = (data.telefono || '').trim();
  const lugar = (data.lugar || data.zona_entrega || '').trim();
  const horario = (data.horario || '').trim();
  const condiciones = Array.isArray(data.condiciones)
    ? data.condiciones
    : (data.condiciones ? [String(data.condiciones)] : []);
  const notas = (data.notas || '').trim();

  const cleanPhoneDigits = telefono.replace(/\D/g, '');
  let intlPhone = cleanPhoneDigits;
  if (cleanPhoneDigits.startsWith('04') || cleanPhoneDigits.startsWith('02')) {
    intlPhone = '58' + cleanPhoneDigits.slice(1);
  } else if (!cleanPhoneDigits.startsWith('58') && cleanPhoneDigits.length === 10) {
    intlPhone = '58' + cleanPhoneDigits;
  }

  const copyField = (fieldKey, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const greetingMsg = encodeURIComponent(
    `Hola ${recipientName ? recipientName + ', ' : ''}te contacto desde Mutual Familiar para coordinar la entrega en efectivo${montoUsd ? ' de $' + montoUsd + ' USD' : ''}.`
  );
  const waUrl = intlPhone ? `https://wa.me/${intlPhone}?text=${greetingMsg}` : null;

  const copyAll = () => {
    const lines = ['💵 Datos para Entrega de Efectivo USD:'];
    if (recipientName) lines.push(`• Receptor: ${recipientName}`);
    if (montoUsd) lines.push(`• Monto: $${montoUsd} USD`);
    if (telefono) lines.push(`• Teléfono / WhatsApp: ${telefono}`);
    if (lugar) lines.push(`• Lugar / Zona: ${lugar}`);
    if (horario) lines.push(`• Horario de preferencia: ${horario}`);
    if (condiciones.length > 0) lines.push(`• Condiciones de billetes: ${condiciones.join(', ')}`);
    if (notas) lines.push(`• Notas adicionales: ${notas}`);

    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div style={{
      backgroundColor: 'rgba(6, 78, 59, 0.22)',
      borderRadius: '12px',
      padding: '14px',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      marginBottom: '14px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 'bold', fontSize: '0.95rem' }}>
            <span>💵</span>
            <span>Coordinación de Entrega en Efectivo USD</span>
          </div>
          {recipientName && (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
              Receptor: {recipientName}
            </div>
          )}
        </div>
        <span style={{
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#6ee7b7',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '700',
          border: '1px solid rgba(16, 185, 129, 0.4)',
        }}>
          USD Físico
        </span>
      </div>

      {montoUsd && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          textAlign: 'center',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Monto a entregar en mano:</div>
          <div style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 'bold', marginTop: '2px' }}>
            ${montoUsd} USD
          </div>
        </div>
      )}

      {telefono && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Teléfono para coordinar entrega:</div>
              <div style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                {telefono}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyField('tel', telefono)}
              style={{
                background: 'none',
                border: 'none',
                color: '#34d399',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {copiedField === 'tel' ? '✅ Copiado' : '📋 Copiar'}
            </button>
          </div>
          {waUrl && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                }}
              >
                💬 Abrir WhatsApp para coordinar
              </a>
            </div>
          )}
        </div>
      )}

      {lugar && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Lugar o zona de preferencia:</div>
            <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: '600' }}>{lugar}</div>
          </div>
          <button
            type="button"
            onClick={() => copyField('lugar', lugar)}
            style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {copiedField === 'lugar' ? '✅ Copiado' : '📋 Copiar'}
          </button>
        </div>
      )}

      {horario && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Días y horario preferido para entrega:</div>
          <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: '600', marginTop: '2px' }}>{horario}</div>
        </div>
      )}

      {condiciones.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 'bold' }}>
            ⚠️ Requisitos de billetes:
          </div>
          <div style={{ color: '#fef3c7', fontSize: '0.75rem', marginTop: '4px' }}>
            {condiciones.join(', ')}
          </div>
        </div>
      )}

      {notas && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          borderLeft: '3px solid #10b981',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold' }}>Notas adicionales:</div>
          <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px', fontStyle: 'italic' }}>{notas}</div>
        </div>
      )}

      <button
        type="button"
        onClick={copyAll}
        style={{
          width: '100%',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '8px',
          padding: '9px',
          color: '#6ee7b7',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          cursor: 'pointer',
          marginTop: '4px',
        }}
      >
        {copiedField === 'all' ? '✅ ¡Datos de entrega copiados!' : '📋 Copiar datos de coordinación'}
      </button>
    </div>
  );
}
