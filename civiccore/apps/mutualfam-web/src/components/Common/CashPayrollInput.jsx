import React from 'react';

export const CASH_DENOMINATIONS = [100, 50, 20, 10, 5, 1];

export default function CashPayrollInput({
  targetAmount = 0,
  payroll = {},
  onPayrollChange,
  serials = '',
  onSerialsChange,
  deliveryNote = '',
  onDeliveryNoteChange,
}) {
  const currentPayroll = payroll || {};

  const handleDelta = (den, delta) => {
    const current = parseInt(currentPayroll[den], 10) || 0;
    const nextVal = Math.max(0, current + delta);
    const updated = {
      ...currentPayroll,
      [den]: nextVal,
    };
    if (onPayrollChange) onPayrollChange(updated);
  };

  const handleClear = () => {
    const cleared = {};
    CASH_DENOMINATIONS.forEach((d) => {
      cleared[d] = 0;
    });
    if (onPayrollChange) onPayrollChange(cleared);
  };

  const totalCalculated = CASH_DENOMINATIONS.reduce((sum, den) => {
    const qty = parseInt(currentPayroll[den], 10) || 0;
    return sum + (qty * den);
  }, 0);

  const hasAnyBills = totalCalculated > 0;
  const numTarget = parseFloat(targetAmount) || 0;
  const diff = numTarget > 0 ? Number((totalCalculated - numTarget).toFixed(2)) : 0;

  return (
    <div style={{ margin: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <span>🧮</span>
            <span>Nómina / Desglose de Billetes</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
            Indica la cantidad de billetes de cada denominación que vas a entregar.
          </div>
        </div>
        {hasAnyBills && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Grid de Denominaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
        {CASH_DENOMINATIONS.map((den) => {
          const count = parseInt(currentPayroll[den], 10) || 0;
          const subtotal = count * den;
          const isActive = count > 0;

          return (
            <div
              key={den}
              style={{
                backgroundColor: isActive ? 'rgba(6, 78, 59, 0.28)' : 'rgba(15, 23, 42, 0.65)',
                borderRadius: '8px',
                padding: '8px 10px',
                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 'bold', color: isActive ? '#10b981' : '#f8fafc' }}>
                  ${den}
                </span>
                {isActive && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6ee7b7' }}>
                    = ${subtotal}
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                padding: '3px',
              }}>
                <button
                  type="button"
                  onClick={() => handleDelta(den, -1)}
                  disabled={count === 0}
                  style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: count === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.2)',
                    borderRadius: '4px',
                    border: 'none',
                    color: count === 0 ? '#64748b' : '#34d399',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    cursor: count === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  −
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isActive ? '#f8fafc' : '#94a3b8' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {count === 1 ? 'billete' : 'billetes'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelta(den, 1)}
                  style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderRadius: '4px',
                    border: 'none',
                    color: '#34d399',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '8px',
        padding: '10px 12px',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>
            Total en Billetes Seleccionados:
          </span>
          <span style={{ color: '#10b981', fontSize: '1.15rem', fontWeight: 'bold' }}>
            ${totalCalculated} USD
          </span>
        </div>

        {numTarget > 0 && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {diff === 0 && totalCalculated > 0 ? (
              <div style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: '600' }}>
                ✅ ¡Cuadre exacto! La nómina coincide con los ${numTarget} USD acordados.
              </div>
            ) : diff < 0 ? (
              <div style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: '600' }}>
                ⚠️ Faltan ${Math.abs(diff)} USD para completar los ${numTarget} USD requeridos.
              </div>
            ) : (
              <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: '600' }}>
                ℹ️ La suma sobrepasa por ${diff} USD el monto acordado (${numTarget} USD).
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seriales de billetes */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>
          Seriales de Billetes (Opcional)
        </label>
        <textarea
          rows={2}
          value={serials}
          onChange={(e) => onSerialsChange && onSerialsChange(e.target.value)}
          placeholder="Ej: MB12345678A ($100), LB98765432B ($50)"
          style={{
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 10px',
            color: '#fff',
            fontSize: '0.85rem',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
        <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '2px', fontStyle: 'italic' }}>
          Registrar los seriales facilita la verificación al entregar y protege a ambas partes.
        </div>
      </div>

      {/* Nota / Lugar de entrega */}
      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>
          Lugar / Nota de Entrega (Opcional)
        </label>
        <input
          type="text"
          value={deliveryNote}
          onChange={(e) => onDeliveryNoteChange && onDeliveryNoteChange(e.target.value)}
          placeholder="Ej: Entregado en mano en la oficina / acordado para hoy a las 3:00 pm"
          style={{
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 10px',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        />
      </div>
    </div>
  );
}
