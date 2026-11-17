import React, { useState, useEffect } from 'react';
import { loansApi } from '@civiccore/sdk';
import {
  VENEZUELAN_BANKS,
  getBankLabel,
  cleanAccountNumber,
  formatAccountNumber,
  findBankByAccount,
} from '../../utils/banks';
import {
  getPersistedPaymentConfig,
  setPersistedPaymentConfig,
  loadUserPaymentConfig,
} from '../../utils/paymentConfig';

export const DOCUMENT_TYPES = [
  { prefix: 'V', title: 'V - Venezolano' },
  { prefix: 'E', title: 'E - Extranjero' },
  { prefix: 'J', title: 'J - Jurídico / Comercio (RIF)' },
  { prefix: 'G', title: 'G - Gubernamental (RIF)' },
  { prefix: 'C', title: 'C - Comuna / Consejo Comunal (RIF)' },
];

export const CASH_USD_TYPICAL_CONDITIONS = [
  'Billetes en buen estado (sin roturas, manchas ni rayones)',
  'Monto exacto (no se dispone de vuelto en divisas)',
  'Series posteriores a 2013 (azules)',
  'Acepto billetes de cualquier denominación ($1 a $100)',
  'Preferiblemente billetes de $10, $20 o $50',
];

export const CASH_USD_QUICK_SCHEDULES = [
  'Lunes a Viernes (9:00 am - 4:00 pm)',
  'Fines de semana previa cita',
  'Horario corrido (8:30 am - 5:30 pm)',
  'A convenir por WhatsApp',
];

export default function PaymentConfigModal({
  visible,
  onClose,
  onSuccess,
  initialConfig = null,
}) {
  const [activeTab, setActiveTab] = useState('pago_movil'); // 'pago_movil' | 'transferencia' | 'efectivo'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({});

  // Form states
  // Pago Móvil
  const [pmBanco, setPmBanco] = useState('0102');
  const [pmDocPrefix, setPmDocPrefix] = useState('V');
  const [pmCedulaNum, setPmCedulaNum] = useState('');
  const [pmTelefono, setPmTelefono] = useState('');

  // Transferencia Bancaria
  const [tbBanco, setTbBanco] = useState('0102');
  const [tbCuenta, setTbCuenta] = useState('');
  const [tbTitular, setTbTitular] = useState('');
  const [tbDocPrefix, setTbDocPrefix] = useState('V');
  const [tbCedulaNum, setTbCedulaNum] = useState('');

  // Efectivo USD
  const [usdTelefono, setUsdTelefono] = useState('');
  const [usdLugar, setUsdLugar] = useState('');
  const [usdHorario, setUsdHorario] = useState('');
  const [usdCondiciones, setUsdCondiciones] = useState([]);
  const [usdNotas, setUsdNotas] = useState('');

  // Load config on mount or open
  useEffect(() => {
    if (!visible) return;

    const init = async () => {
      setLoading(true);
      try {
        const loaded = initialConfig && Object.keys(initialConfig).length > 0
          ? initialConfig
          : await loadUserPaymentConfig();
        setConfig(loaded || {});
        populateFields(loaded || {});
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [visible, initialConfig]);

  const populateFields = (c) => {
    // Pago Móvil
    const pm = c['Pago Móvil'] || {};
    if (pm.banco) setPmBanco(pm.banco);
    if (pm.telefono) setPmTelefono(pm.telefono);
    if (pm.cedula) {
      const parts = String(pm.cedula).trim().split('-');
      if (parts.length >= 2) {
        setPmDocPrefix(parts[0].toUpperCase());
        setPmCedulaNum(parts.slice(1).join(''));
      } else {
        const prefix = pm.cedula.charAt(0).toUpperCase();
        if (['V', 'E', 'J', 'G', 'C'].includes(prefix)) {
          setPmDocPrefix(prefix);
          setPmCedulaNum(pm.cedula.slice(1).replace(/\D/g, ''));
        } else {
          setPmCedulaNum(pm.cedula.replace(/\D/g, ''));
        }
      }
    }

    // Transferencia
    const tb = c['Transferencia Bancaria'] || {};
    if (tb.banco) setTbBanco(tb.banco);
    if (tb.numero_cuenta) setTbCuenta(formatAccountNumber(tb.numero_cuenta));
    if (tb.titular) setTbTitular(tb.titular);
    if (tb.cedula) {
      const parts = String(tb.cedula).trim().split('-');
      if (parts.length >= 2) {
        setTbDocPrefix(parts[0].toUpperCase());
        setTbCedulaNum(parts.slice(1).join(''));
      } else {
        const prefix = tb.cedula.charAt(0).toUpperCase();
        if (['V', 'E', 'J', 'G', 'C'].includes(prefix)) {
          setTbDocPrefix(prefix);
          setTbCedulaNum(tb.cedula.slice(1).replace(/\D/g, ''));
        } else {
          setTbCedulaNum(tb.cedula.replace(/\D/g, ''));
        }
      }
    }

    // Efectivo USD
    const usd = c['Efectivo USD'] || {};
    if (usd.telefono) setUsdTelefono(usd.telefono);
    if (usd.lugar || usd.zona_entrega) setUsdLugar(usd.lugar || usd.zona_entrega);
    if (usd.horario) setUsdHorario(usd.horario);
    if (Array.isArray(usd.condiciones)) setUsdCondiciones(usd.condiciones);
    if (usd.notas) setUsdNotas(usd.notas);
  };

  const handleCuentaChange = (val) => {
    const raw = cleanAccountNumber(val);
    setTbCuenta(formatAccountNumber(raw));
    if (raw.length >= 4) {
      const detectedBank = findBankByAccount(raw);
      if (detectedBank) {
        setTbBanco(detectedBank.code);
      }
    }
  };

  const handleToggleCondicion = (cond) => {
    setUsdCondiciones((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newConfig = { ...config };

      // 1. Pago Móvil
      const cleanPmTel = pmTelefono.replace(/\D/g, '');
      const cleanPmCed = pmCedulaNum.replace(/\D/g, '');
      if (pmBanco && cleanPmCed && cleanPmTel) {
        newConfig['Pago Móvil'] = {
          banco: pmBanco,
          cedula: `${pmDocPrefix}-${cleanPmCed}`,
          telefono: pmTelefono.trim(),
        };
      } else if (!pmTelefono.trim() && !pmCedulaNum.trim()) {
        delete newConfig['Pago Móvil'];
      }

      // 2. Transferencia
      const cleanTbAcc = cleanAccountNumber(tbCuenta);
      const cleanTbCed = tbCedulaNum.replace(/\D/g, '');
      if (tbBanco && cleanTbAcc && tbTitular.trim() && cleanTbCed) {
        newConfig['Transferencia Bancaria'] = {
          banco: tbBanco,
          numero_cuenta: cleanTbAcc,
          titular: tbTitular.trim(),
          cedula: `${tbDocPrefix}-${cleanTbCed}`,
        };
      } else if (!cleanTbAcc && !tbTitular.trim()) {
        delete newConfig['Transferencia Bancaria'];
      }

      // 3. Efectivo USD
      const cleanUsdTel = usdTelefono.trim();
      const cleanUsdLug = usdLugar.trim();
      if (cleanUsdTel && cleanUsdLug) {
        newConfig['Efectivo USD'] = {
          telefono: cleanUsdTel,
          lugar: cleanUsdLug,
          horario: usdHorario.trim() || undefined,
          condiciones: usdCondiciones.length > 0 ? usdCondiciones : undefined,
          notas: usdNotas.trim() || undefined,
        };
      } else if (!cleanUsdTel && !cleanUsdLug) {
        delete newConfig['Efectivo USD'];
      }

      await loansApi.savePaymentMethods({
        payment_methods_json: JSON.stringify(newConfig),
      });

      setPersistedPaymentConfig(newConfig);
      setConfig(newConfig);
      if (onSuccess) onSuccess(newConfig);
      alert('¡Datos de pago guardados exitosamente!');
      onClose();
    } catch (err) {
      alert('Error al guardar datos de pago: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      overflowY: 'auto',
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
              ⚙️ Mis Datos de Pago
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Configura tus datos para recibir pagos de préstamos y aportes de colectas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#090e17',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('pago_movil')}
            style={{
              flex: 1,
              padding: '12px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'pago_movil' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'pago_movil' ? '#10b981' : '#94a3b8',
              fontWeight: activeTab === 'pago_movil' ? 'bold' : 'normal',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            📱 Pago Móvil
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transferencia')}
            style={{
              flex: 1,
              padding: '12px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'transferencia' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'transferencia' ? '#10b981' : '#94a3b8',
              fontWeight: activeTab === 'transferencia' ? 'bold' : 'normal',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            🏦 Transferencia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('efectivo')}
            style={{
              flex: 1,
              padding: '12px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'efectivo' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'efectivo' ? '#10b981' : '#94a3b8',
              fontWeight: activeTab === 'efectivo' ? 'bold' : 'normal',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            💵 Efectivo USD
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          {activeTab === 'pago_movil' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Banco Receptor
                </label>
                <select
                  value={pmBanco}
                  onChange={(e) => setPmBanco(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                >
                  {VENEZUELAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Cédula / Documento de Identidad
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={pmDocPrefix}
                    onChange={(e) => setPmDocPrefix(e.target.value)}
                    style={{
                      width: '75px',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {DOCUMENT_TYPES.map((d) => (
                      <option key={d.prefix} value={d.prefix}>{d.prefix}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={pmCedulaNum}
                    onChange={(e) => setPmCedulaNum(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Teléfono Afiliado a Pago Móvil
                </label>
                <input
                  type="text"
                  value={pmTelefono}
                  onChange={(e) => setPmTelefono(e.target.value)}
                  placeholder="04141234567"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </>
          )}

          {activeTab === 'transferencia' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Número de Cuenta (20 Dígitos)
                </label>
                <input
                  type="text"
                  value={tbCuenta}
                  onChange={(e) => handleCuentaChange(e.target.value)}
                  placeholder="0102 0123 45 6789012345"
                  maxLength={23}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    letterSpacing: '1px',
                  }}
                />
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                  Banco detectado: {getBankLabel(tbBanco)}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Titular de la Cuenta
                </label>
                <input
                  type="text"
                  value={tbTitular}
                  onChange={(e) => setTbTitular(e.target.value)}
                  placeholder="Nombre y Apellido o Razón Social"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Cédula / RIF del Titular
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={tbDocPrefix}
                    onChange={(e) => setTbDocPrefix(e.target.value)}
                    style={{
                      width: '75px',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {DOCUMENT_TYPES.map((d) => (
                      <option key={d.prefix} value={d.prefix}>{d.prefix}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={tbCedulaNum}
                    onChange={(e) => setTbCedulaNum(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'efectivo' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Teléfono / WhatsApp para Coordinar Entrega *
                </label>
                <input
                  type="text"
                  value={usdTelefono}
                  onChange={(e) => setUsdTelefono(e.target.value)}
                  placeholder="Ej: 04141234567"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Lugar o Zona de Preferencia *
                </label>
                <input
                  type="text"
                  value={usdLugar}
                  onChange={(e) => setUsdLugar(e.target.value)}
                  placeholder="Ej: Altamira / Centro Comercial / Casa de la abuela"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Días y Horarios de Preferencia
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {CASH_USD_QUICK_SCHEDULES.map((sched) => (
                    <button
                      key={sched}
                      type="button"
                      onClick={() => setUsdHorario(usdHorario === sched ? '' : sched)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: usdHorario === sched ? '1px solid #10b981' : '1px solid #334155',
                        backgroundColor: usdHorario === sched ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: usdHorario === sched ? '#6ee7b7' : '#94a3b8',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {sched}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={usdHorario}
                  onChange={(e) => setUsdHorario(e.target.value)}
                  placeholder="O escribe un horario personalizado..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Condiciones de los Billetes
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {CASH_USD_TYPICAL_CONDITIONS.map((cond) => {
                    const isSelected = usdCondiciones.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => handleToggleCondicion(cond)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid #10b981' : '1px solid #334155',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#6ee7b7' : '#94a3b8',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{cond}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Notas o Instrucciones Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={usdNotas}
                  onChange={(e) => setUsdNotas(e.target.value)}
                  placeholder="Ej: Avisar 1 hora antes de salir..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </>
          )}

          {/* Footer actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #1e293b',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent-primary, #10b981)',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

