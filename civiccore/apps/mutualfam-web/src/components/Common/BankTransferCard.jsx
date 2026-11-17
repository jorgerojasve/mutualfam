import React, { useState } from 'react';
import {
  VENEZUELAN_BANKS,
  getBankLabel,
  formatAccountNumber,
  cleanAccountNumber,
} from '../../utils/banks';

export default function BankTransferCard({
  data,
  montoBs,
  tasaLabel,
  recipientName,
  banks = VENEZUELAN_BANKS,
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
        No se encontraron datos de transferencia bancaria configurados.
      </div>
    );
  }

  const getPrefix = (tipo) => {
    if (!tipo || tipo === 'Persona' || tipo === 'V') return 'V';
    if (tipo === 'Extranjero' || tipo === 'E') return 'E';
    if (tipo === 'Comercio' || tipo === 'J') return 'J';
    if (tipo === 'Gubernamental' || tipo === 'G') return 'G';
    if (tipo === 'Comuna' || tipo === 'C') return 'C';
    return tipo[0] || 'V';
  };

  const docPrefix = getPrefix(data.tipo_doc);
  const cleanCedula = data.cedula ? String(data.cedula).replace(/^[VJEGC]-?/i, '') : '';
  const safeDoc = cleanCedula ? `${docPrefix}-${cleanCedula}` : '';
  const rawAccount = cleanAccountNumber(data.numero_cuenta);
  const formattedAccount = formatAccountNumber(rawAccount);
  const bankLabel = getBankLabel(data.banco, banks);
  const tipoCuenta = data.tipo_cuenta || 'Corriente';

  const copyField = (fieldKey, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    const lines = [
      'Datos de Transferencia Bancaria:',
      `• Banco: ${bankLabel}`,
      `• Cuenta: ${rawAccount}`,
      `• Tipo: ${tipoCuenta}`,
    ];
    if (data.titular) lines.push(`• Titular: ${data.titular}`);
    if (safeDoc) lines.push(`• Documento / RIF: ${safeDoc}`);
    if (data.email) lines.push(`• Correo: ${data.email}`);
    if (data.telefono) lines.push(`• Teléfono: ${data.telefono}`);
    if (montoBs) lines.push(`• Monto: Bs. ${montoBs}`);

    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div style={{
      backgroundColor: 'rgba(30, 41, 59, 0.7)',
      borderRadius: '12px',
      padding: '14px',
      border: '1px solid rgba(129, 140, 248, 0.35)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a5b4fc', fontWeight: 'bold', fontSize: '0.95rem' }}>
            <span>🔄</span>
            <span>Datos de Transferencia Bancaria</span>
          </div>
          {recipientName && (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
              Destinatario: {recipientName}
            </div>
          )}
        </div>
        <span style={{
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          color: '#c7d2fe',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}>
          {tipoCuenta}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Monto a transferir si está disponible */}
        {montoBs && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '8px 10px',
            borderRadius: '6px',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Monto a transferir {tasaLabel ? `(${tasaLabel})` : ''}
              </div>
              <div style={{ fontSize: '1rem', color: '#10b981', fontWeight: 'bold' }}>
                Bs. {montoBs}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyField('monto', montoBs)}
              style={{
                background: 'none',
                border: 'none',
                color: copiedField === 'monto' ? '#34d399' : '#818cf8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              {copiedField === 'monto' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Banco */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          padding: '8px 10px',
          borderRadius: '6px',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Banco Destino</div>
            <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>
              {bankLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyField('banco', bankLabel)}
            style={{
              background: 'none',
              border: 'none',
              color: copiedField === 'banco' ? '#34d399' : '#818cf8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            {copiedField === 'banco' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Número de cuenta */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          padding: '8px 10px',
          borderRadius: '6px',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Número de Cuenta (20 dígitos)</div>
            <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.8px', fontFamily: 'monospace' }}>
              {formattedAccount}
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyField('cuenta', rawAccount)}
            style={{
              background: 'none',
              border: 'none',
              color: copiedField === 'cuenta' ? '#34d399' : '#818cf8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            {copiedField === 'cuenta' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Titular */}
        {data.titular && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '8px 10px',
            borderRadius: '6px',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Titular de la Cuenta</div>
              <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>
                {data.titular}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyField('titular', data.titular)}
              style={{
                background: 'none',
                border: 'none',
                color: copiedField === 'titular' ? '#34d399' : '#818cf8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              {copiedField === 'titular' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Documento / Cédula / RIF */}
        {safeDoc && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '8px 10px',
            borderRadius: '6px',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Documento de Identidad / RIF</div>
              <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>
                {safeDoc}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyField('doc', safeDoc)}
              style={{
                background: 'none',
                border: 'none',
                color: copiedField === 'doc' ? '#34d399' : '#818cf8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              {copiedField === 'doc' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Correo */}
        {data.email && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '8px 10px',
            borderRadius: '6px',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Correo Electrónico</div>
              <div style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
                {data.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyField('email', data.email)}
              style={{
                background: 'none',
                border: 'none',
                color: copiedField === 'email' ? '#34d399' : '#818cf8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              {copiedField === 'email' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Botón Copiar Todo */}
        <button
          type="button"
          onClick={copyAll}
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(129, 140, 248, 0.35)',
            color: copiedField === 'all' ? '#34d399' : '#a5b4fc',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.8rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginTop: '4px',
            textAlign: 'center',
          }}
        >
          {copiedField === 'all' ? '✅ ¡Copiado al portapapeles!' : '📋 Copiar todos los datos de transferencia'}
        </button>
      </div>
    </div>
  );
}

