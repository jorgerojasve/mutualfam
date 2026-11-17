import React, { useState, useEffect } from 'react';
import { loansApi } from '@civiccore/sdk';
import {
  Smartphone,
  ArrowLeftRight,
  Banknote,
  Wallet,
  CreditCard,
  Check,
  ChevronRight,
  ArrowLeft,
  X,
  Search,
  AlertCircle,
  Info,
} from 'lucide-react';
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

export const AVAILABLE_PAYMENT_METHODS = [
  'Pago Móvil',
  'Transferencia Bancaria',
  'Efectivo USD',
  'Efectivo Bolívares',
  'Binance',
];

export const DOCUMENT_TYPES = [
  { key: 'Persona', prefix: 'V', title: 'V - Venezolano', subtitle: 'Cédula de identidad venezolana' },
  { key: 'Extranjero', prefix: 'E', title: 'E - Extranjero', subtitle: 'Cédula de extranjería' },
  { key: 'Comercio', prefix: 'J', title: 'J - Jurídico / Comercio (RIF)', subtitle: 'Empresas, comercios y firmas personales' },
  { key: 'Gubernamental', prefix: 'G', title: 'G - Gubernamental (RIF)', subtitle: 'Instituciones públicas y entes del Estado' },
  { key: 'Comuna', prefix: 'C', title: 'C - Comuna / Consejo Comunal (RIF)', subtitle: 'Comunas, consejos comunales y poder popular' },
];

export const getDocTypeInfo = (tipo) => {
  const t = (tipo || 'Persona').toString().trim();
  if (t === 'Persona' || t === 'V') return DOCUMENT_TYPES[0];
  if (t === 'Extranjero' || t === 'E') return DOCUMENT_TYPES[1];
  if (t === 'Comercio' || t === 'J') return DOCUMENT_TYPES[2];
  if (t === 'Gubernamental' || t === 'G') return DOCUMENT_TYPES[3];
  if (t === 'Comuna' || t === 'C') return DOCUMENT_TYPES[4];
  return DOCUMENT_TYPES[0];
};

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
  const [paymentConfig, setPaymentConfig] = useState(initialConfig || {});
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectedConfigMethod, setSelectedConfigMethod] = useState(null);
  const [banks, setBanks] = useState(VENEZUELAN_BANKS);
  const [isPickingBank, setIsPickingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pmErrors, setPmErrors] = useState({});
  const [tbErrors, setTbErrors] = useState({});
  const [usdErrors, setUsdErrors] = useState({});

  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      setSelectedConfigMethod(null);
      setIsPickingBank(false);
      setBankSearch('');
      setPmErrors({});
      setTbErrors({});
      setUsdErrors({});
    }
  }, [visible]);

  const loadData = async () => {
    setLoadingInitial(true);
    try {
      let loaded = null;
      try {
        const pmRes = await loansApi.getPaymentMethods();
        if (pmRes?.payment_methods_json) {
          loaded = JSON.parse(pmRes.payment_methods_json);
        }
      } catch (_) {}

      if (!loaded && initialConfig && Object.keys(initialConfig).length > 0) {
        loaded = initialConfig;
      }

      if (!loaded) {
        const cached = getPersistedPaymentConfig();
        if (cached && Object.keys(cached).length > 0) {
          loaded = cached;
        }
      }

      const cfg = loaded || {};
      setPaymentConfig(cfg);
      setPersistedPaymentConfig(cfg);

      try {
        if (typeof loansApi.getBanks === 'function') {
          const banksRes = await loansApi.getBanks();
          if (Array.isArray(banksRes) && banksRes.length > 0) {
            setBanks(banksRes);
          }
        }
      } catch (_) {}
    } catch (e) {
      console.warn('Error loading payment config or banks', e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleConfirmConfigMethod = () => {
    if (selectedConfigMethod === 'Pago Móvil') {
      const pm = paymentConfig['Pago Móvil'] || {};
      const banco = (pm.banco || '').trim();
      const cedula = (pm.cedula || '').trim();
      const telefono = (pm.telefono || '').trim().replace(/[-\s]/g, '');

      const isEmpty = !banco && !cedula && !telefono;
      if (isEmpty) {
        setPmErrors({});
        const updatedConfig = { ...paymentConfig };
        delete updatedConfig['Pago Móvil'];
        setPaymentConfig(updatedConfig);
        setSelectedConfigMethod(null);
        return;
      }

      const errors = {};
      if (!banco) {
        errors.banco = 'Debes seleccionar un banco.';
      }
      if (!cedula) {
        errors.cedula = 'Ingresa el número de documento.';
      } else if (!/^\d{5,10}$/.test(cedula)) {
        errors.cedula = 'El documento debe tener entre 5 y 10 dígitos numéricos.';
      }
      if (!telefono) {
        errors.telefono = 'Ingresa el número de teléfono.';
      } else if (!/^04\d{9}$/.test(telefono)) {
        errors.telefono = 'El teléfono debe comenzar con 04 y tener 11 dígitos (ej. 04141234567).';
      }

      if (Object.keys(errors).length > 0) {
        setPmErrors(errors);
        return;
      }

      setPmErrors({});
      setPaymentConfig({
        ...paymentConfig,
        'Pago Móvil': {
          ...(pm || {}),
          banco,
          tipo_doc: pm.tipo_doc || 'Persona',
          cedula,
          telefono,
        },
      });
      setSelectedConfigMethod(null);
      return;
    }

    if (selectedConfigMethod === 'Transferencia Bancaria') {
      const tb = paymentConfig['Transferencia Bancaria'] || {};
      const banco = (tb.banco || '').trim();
      const tipo_cuenta = tb.tipo_cuenta || 'Corriente';
      const numero_cuenta = cleanAccountNumber(tb.numero_cuenta);
      const titular = (tb.titular || '').trim();
      const tipo_doc = tb.tipo_doc || 'Persona';
      const cedula = (tb.cedula || '').trim().replace(/\D/g, '');
      const email = (tb.email || '').trim().toLowerCase();
      const telefono = (tb.telefono || '').trim().replace(/[-\s]/g, '');

      const isEmpty = !banco && !numero_cuenta && !titular && !cedula;
      if (isEmpty) {
        setTbErrors({});
        const updatedConfig = { ...paymentConfig };
        delete updatedConfig['Transferencia Bancaria'];
        setPaymentConfig(updatedConfig);
        setSelectedConfigMethod(null);
        return;
      }

      const errors = {};
      if (!banco) {
        errors.banco = 'Debes seleccionar un banco.';
      }
      if (!numero_cuenta) {
        errors.numero_cuenta = 'Ingresa el número de cuenta de 20 dígitos.';
      } else if (numero_cuenta.length !== 20) {
        errors.numero_cuenta = `El número de cuenta debe tener exactamente 20 dígitos (actualmente ${numero_cuenta.length}).`;
      } else if (banco && numero_cuenta.slice(0, 4) !== banco) {
        errors.numero_cuenta = `Los primeros 4 dígitos deben coincidir con el código del banco seleccionado (${banco}).`;
      }

      if (!titular) {
        errors.titular = 'Ingresa el nombre del titular de la cuenta.';
      } else if (titular.length < 3) {
        errors.titular = 'El nombre del titular debe tener al menos 3 caracteres.';
      }

      if (!cedula) {
        errors.cedula = 'Ingresa el número de documento / RIF.';
      } else if (!/^\d{5,10}$/.test(cedula)) {
        errors.cedula = 'El documento debe tener entre 5 y 10 dígitos numéricos.';
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Ingresa un correo electrónico válido o déjalo en blanco.';
      }

      if (Object.keys(errors).length > 0) {
        setTbErrors(errors);
        return;
      }

      setTbErrors({});
      setPaymentConfig({
        ...paymentConfig,
        'Transferencia Bancaria': {
          ...(tb || {}),
          banco,
          tipo_cuenta,
          numero_cuenta,
          titular,
          tipo_doc,
          cedula,
          email: email || undefined,
          telefono: telefono || undefined,
        },
      });
      setSelectedConfigMethod(null);
      return;
    }

    if (selectedConfigMethod === 'Efectivo USD') {
      const usd = typeof paymentConfig['Efectivo USD'] === 'object' && paymentConfig['Efectivo USD'] !== null
        ? paymentConfig['Efectivo USD']
        : {};
      const telefono = (usd.telefono || '').trim().replace(/[-\s]/g, '');
      const lugar = (usd.lugar || usd.zona_entrega || '').trim();
      const horario = (usd.horario || '').trim();
      const condiciones = Array.isArray(usd.condiciones) ? usd.condiciones : [];
      const notas = (usd.notas || '').trim();

      const isEmpty = !telefono && !lugar && !horario && condiciones.length === 0 && !notas;
      if (isEmpty) {
        setUsdErrors({});
        const updatedConfig = { ...paymentConfig };
        delete updatedConfig['Efectivo USD'];
        setPaymentConfig(updatedConfig);
        setSelectedConfigMethod(null);
        return;
      }

      const errors = {};
      if (!telefono) {
        errors.telefono = 'Ingresa el teléfono o WhatsApp para coordinar la entrega.';
      } else if (telefono.replace(/\D/g, '').length < 10) {
        errors.telefono = 'El teléfono debe tener al menos 10 dígitos (ej. 04141234567).';
      }

      if (!lugar) {
        errors.lugar = 'Ingresa el lugar o zona de preferencia para la entrega.';
      } else if (lugar.length < 3) {
        errors.lugar = 'Indica una zona o lugar válido (al menos 3 caracteres).';
      }

      if (Object.keys(errors).length > 0) {
        setUsdErrors(errors);
        return;
      }

      setUsdErrors({});
      setPaymentConfig({
        ...paymentConfig,
        'Efectivo USD': {
          telefono: (usd.telefono || '').trim(),
          lugar,
          horario: horario || undefined,
          condiciones: condiciones.length > 0 ? condiciones : undefined,
          notas: notas || undefined,
        },
      });
      setSelectedConfigMethod(null);
      return;
    }

    setSelectedConfigMethod(null);
  };

  const handleSaveConfig = async () => {
    const configToSave = { ...paymentConfig };

    for (const method of Object.keys(configToSave)) {
      if (method === 'Pago Móvil') {
        const pm = configToSave['Pago Móvil'];
        if (typeof pm === 'object') {
          const isEmpty = !pm.banco && !pm.telefono && !pm.cedula;
          if (isEmpty) {
            delete configToSave['Pago Móvil'];
          } else if (!pm.banco || !pm.telefono || !pm.cedula) {
            alert('Por favor completa todos los campos de Pago Móvil (banco, documento y teléfono) o déjalos en blanco para eliminar el método.');
            return;
          }
        }
      } else if (method === 'Transferencia Bancaria') {
        const tb = configToSave['Transferencia Bancaria'];
        if (typeof tb === 'object') {
          const isEmpty = !tb.banco && !tb.numero_cuenta && !tb.titular && !tb.cedula;
          if (isEmpty) {
            delete configToSave['Transferencia Bancaria'];
          } else if (
            !tb.banco ||
            !tb.numero_cuenta ||
            cleanAccountNumber(tb.numero_cuenta).length !== 20 ||
            !tb.titular ||
            !tb.cedula
          ) {
            alert('Por favor completa todos los campos requeridos de Transferencia Bancaria (banco, cuenta de 20 dígitos, titular y documento) o déjalos en blanco para eliminar el método.');
            return;
          }
        }
      } else if (method === 'Efectivo USD') {
        const usd = configToSave['Efectivo USD'];
        if (typeof usd === 'object' && usd !== null) {
          const isEmpty = !usd.telefono && !usd.lugar && !usd.zona_entrega && !usd.horario && !usd.notas;
          if (isEmpty) {
            delete configToSave['Efectivo USD'];
          } else if (!usd.telefono || (!usd.lugar && !usd.zona_entrega)) {
            alert('Por favor completa al menos el teléfono y lugar de entrega para Efectivo USD, o déjalos en blanco para eliminar el método.');
            return;
          }
        }
      } else {
        if (!configToSave[method] || String(configToSave[method]).trim() === '') {
          delete configToSave[method];
        }
      }
    }

    setSavingConfig(true);
    try {
      setPersistedPaymentConfig(configToSave);
      if (typeof loansApi.updatePaymentMethods === 'function') {
        await loansApi.updatePaymentMethods(JSON.stringify(configToSave));
      } else {
        await loansApi.savePaymentMethods({ payment_methods_json: JSON.stringify(configToSave) });
      }
      setPaymentConfig(configToSave);
      if (onSuccess) onSuccess(configToSave);
      alert('Tus datos de pago han sido guardados exitosamente.');
      if (onClose) onClose();
    } catch (e) {
      alert('Error al guardar la configuración de pagos: ' + (e.message || 'Error desconocido'));
    } finally {
      setSavingConfig(false);
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
        maxWidth: '540px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
      }}>
        {/* Loading Spinner inicial */}
        {loadingInitial ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="loader mx-auto mb-3" />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Cargando datos de pago...</p>
          </div>
        ) : isPickingBank ? (
          /* ======================================================== */
          /* SUB-VISTA: SELECCIÓN Y BÚSQUEDA DE BANCOS                 */
          /* ======================================================== */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsPickingBank(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={16} /> Volver
              </button>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', color: '#f8fafc' }}>
                Seleccionar Banco
              </h2>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Buscar por nombre o código (ej. 0102)..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 36px',
                  borderRadius: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              flex: 1,
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid #334155',
              borderRadius: '8px',
              backgroundColor: '#090e17',
              marginBottom: '1rem',
            }}>
              {banks
                .filter((b) => {
                  if (!bankSearch.trim()) return true;
                  const q = bankSearch.toLowerCase().trim();
                  return b.code.includes(q) || b.name.toLowerCase().includes(q);
                })
                .map((b) => {
                  const currentBankCode =
                    selectedConfigMethod === 'Pago Móvil'
                      ? paymentConfig['Pago Móvil']?.banco
                      : paymentConfig['Transferencia Bancaria']?.banco;
                  const isSelected = currentBankCode === b.code;

                  return (
                    <div
                      key={b.code}
                      onClick={() => {
                        if (selectedConfigMethod === 'Pago Móvil') {
                          setPaymentConfig({
                            ...paymentConfig,
                            'Pago Móvil': {
                              ...(paymentConfig['Pago Móvil'] || {}),
                              banco: b.code,
                            },
                          });
                          setPmErrors((prev) => ({ ...prev, banco: null }));
                        } else if (selectedConfigMethod === 'Transferencia Bancaria') {
                          const currentAcc = cleanAccountNumber(
                            paymentConfig['Transferencia Bancaria']?.numero_cuenta || ''
                          );
                          let newAcc = currentAcc;
                          if (!currentAcc) {
                            newAcc = b.code;
                          } else if (currentAcc.length >= 4 && currentAcc.slice(0, 4) !== b.code) {
                            newAcc = b.code + currentAcc.slice(4);
                          }
                          setPaymentConfig({
                            ...paymentConfig,
                            'Transferencia Bancaria': {
                              ...(paymentConfig['Transferencia Bancaria'] || {}),
                              banco: b.code,
                              numero_cuenta: newAcc,
                            },
                          });
                          setTbErrors((prev) => ({ ...prev, banco: null, numero_cuenta: null }));
                        }
                        setIsPickingBank(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 14px',
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                        borderBottom: '1px solid #1e293b',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <span style={{
                        backgroundColor: '#1e3a8a',
                        color: '#93c5fd',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        marginRight: '12px',
                        fontFamily: 'monospace',
                      }}>
                        {b.code}
                      </span>
                      <span style={{ color: '#f8fafc', fontSize: '0.9rem', flex: 1 }}>
                        {b.name}
                      </span>
                      {isSelected && (
                        <Check size={18} color="#10b981" style={{ marginLeft: '8px' }} />
                      )}
                    </div>
                  );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsPickingBank(false)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : !selectedConfigMethod ? (
          /* ======================================================== */
          /* VISTA PRINCIPAL: LISTA VERTICAL DE MÉTODOS (HOMOLOGADO)  */
          /* ======================================================== */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem 1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #1e293b',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
                  ⚙️ Mis Datos de Pago
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Configura tus métodos para recibir pagos de préstamos y aportes de colectas.
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
                  padding: '2px 6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista Vertical de Métodos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem', flex: 1, overflowY: 'auto' }}>
              {AVAILABLE_PAYMENT_METHODS.map((method) => {
                const configItem = paymentConfig[method];
                const isConfigured = Boolean(
                  configItem && (
                    typeof configItem === 'object'
                      ? Object.keys(configItem).length > 0 &&
                        (configItem.banco || configItem.telefono || configItem.numero_cuenta || configItem.lugar)
                      : Boolean(configItem)
                  )
                );
                const isDisabled =
                  method !== 'Pago Móvil' &&
                  method !== 'Transferencia Bancaria' &&
                  method !== 'Efectivo USD';

                return (
                  <div
                    key={method}
                    onClick={() => {
                      if (isDisabled) {
                        alert('Esta opción de pago aún está en desarrollo y no está implementada.');
                        return;
                      }
                      setSelectedConfigMethod(method);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: '#1e293b',
                      borderRadius: '10px',
                      border: isConfigured ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #334155',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) e.currentTarget.style.backgroundColor = '#273549';
                    }}
                    onMouseLeave={(e) => {
                      if (!isDisabled) e.currentTarget.style.backgroundColor = '#1e293b';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {method === 'Pago Móvil' ? (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Smartphone size={18} color="#38bdf8" />
                        </div>
                      ) : method === 'Transferencia Bancaria' ? (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ArrowLeftRight size={18} color="#818cf8" />
                        </div>
                      ) : method === 'Efectivo USD' ? (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Banknote size={18} color="#10b981" />
                        </div>
                      ) : method === 'Efectivo Bolívares' ? (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(148, 163, 184, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wallet size={18} color="#94a3b8" />
                        </div>
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(148, 163, 184, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={18} color="#94a3b8" />
                        </div>
                      )}
                      <div>
                        <div style={{ color: isDisabled ? '#94a3b8' : '#f8fafc', fontWeight: '600', fontSize: '0.95rem' }}>
                          {method}
                        </div>
                        {isDisabled && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Próximamente disponible
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isConfigured && (
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <Check size={12} /> Configurado
                        </span>
                      )}
                      {!isDisabled && (
                        <ChevronRight size={18} color="#64748b" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acciones principales de la vista vertical */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
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
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: savingConfig ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)',
                }}
              >
                {savingConfig ? 'Guardando...' : 'Guardar Todo'}
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* SUB-VISTA: CONFIGURACIÓN ESPECÍFICA DEL MÉTODO           */
          /* ======================================================== */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #1e293b',
              gap: '0.75rem',
            }}>
              <button
                type="button"
                onClick={() => {
                  setPmErrors({});
                  setTbErrors({});
                  setUsdErrors({});
                  setSelectedConfigMethod(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={16} /> Volver
              </button>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc' }}>
                {selectedConfigMethod}
              </h2>
            </div>

            {/* Formulario según el método seleccionado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginBottom: '1.5rem' }}>
              {selectedConfigMethod === 'Pago Móvil' && (
                <>
                  {/* Banco Receptor */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Banco Receptor
                    </label>
                    <div
                      onClick={() => {
                        setBankSearch('');
                        setIsPickingBank(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: pmErrors.banco ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: paymentConfig['Pago Móvil']?.banco ? '#fff' : '#64748b',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {paymentConfig['Pago Móvil']?.banco
                          ? getBankLabel(paymentConfig['Pago Móvil']?.banco, banks)
                          : 'Selecciona tu banco...'}
                      </span>
                      <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: '600', marginLeft: '8px', flexShrink: 0 }}>
                        Elegir ▼
                      </span>
                    </div>
                    {pmErrors.banco && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {pmErrors.banco}
                      </span>
                    )}
                  </div>

                  {/* Tipo de Documento y Número */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Cédula / Documento de Identidad
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={paymentConfig['Pago Móvil']?.tipo_doc || 'Persona'}
                        onChange={(e) => {
                          setPaymentConfig({
                            ...paymentConfig,
                            'Pago Móvil': {
                              ...(paymentConfig['Pago Móvil'] || {}),
                              tipo_doc: e.target.value,
                            },
                          });
                        }}
                        style={{
                          width: '85px',
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
                          <option key={d.key} value={d.key}>{d.prefix} - {d.key}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={paymentConfig['Pago Móvil']?.cedula || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPaymentConfig({
                            ...paymentConfig,
                            'Pago Móvil': {
                              ...(paymentConfig['Pago Móvil'] || {}),
                              cedula: val,
                            },
                          });
                          if (pmErrors.cedula) setPmErrors((prev) => ({ ...prev, cedula: null }));
                        }}
                        placeholder="12345678"
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: '#1e293b',
                          border: pmErrors.cedula ? '1.5px solid #ef4444' : '1px solid #334155',
                          color: '#fff',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                    {pmErrors.cedula && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {pmErrors.cedula}
                      </span>
                    )}
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Teléfono Afiliado a Pago Móvil
                    </label>
                    <input
                      type="text"
                      value={paymentConfig['Pago Móvil']?.telefono || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Pago Móvil': {
                            ...(paymentConfig['Pago Móvil'] || {}),
                            telefono: e.target.value,
                          },
                        });
                        if (pmErrors.telefono) setPmErrors((prev) => ({ ...prev, telefono: null }));
                      }}
                      placeholder="04141234567"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: pmErrors.telefono ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {pmErrors.telefono && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {pmErrors.telefono}
                      </span>
                    )}
                  </div>
                </>
              )}

              {selectedConfigMethod === 'Transferencia Bancaria' && (
                <>
                  {/* Banco Destino */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Banco Destino
                    </label>
                    <div
                      onClick={() => {
                        setBankSearch('');
                        setIsPickingBank(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: tbErrors.banco ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: paymentConfig['Transferencia Bancaria']?.banco ? '#fff' : '#64748b',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {paymentConfig['Transferencia Bancaria']?.banco
                          ? getBankLabel(paymentConfig['Transferencia Bancaria']?.banco, banks)
                          : 'Selecciona el banco de tu cuenta...'}
                      </span>
                      <span style={{ color: '#818cf8', fontSize: '0.8rem', fontWeight: '600', marginLeft: '8px', flexShrink: 0 }}>
                        Elegir ▼
                      </span>
                    </div>
                    {tbErrors.banco && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {tbErrors.banco}
                      </span>
                    )}
                  </div>

                  {/* Tipo de Cuenta */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Tipo de Cuenta
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {['Corriente', 'Ahorro'].map((tipo) => {
                        const active = (paymentConfig['Transferencia Bancaria']?.tipo_cuenta || 'Corriente') === tipo;
                        return (
                          <button
                            key={tipo}
                            type="button"
                            onClick={() =>
                              setPaymentConfig({
                                ...paymentConfig,
                                'Transferencia Bancaria': {
                                  ...(paymentConfig['Transferencia Bancaria'] || {}),
                                  tipo_cuenta: tipo,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '8px',
                              borderRadius: '8px',
                              border: active ? '1px solid #818cf8' : '1px solid #334155',
                              backgroundColor: active ? 'rgba(129, 140, 248, 0.2)' : '#1e293b',
                              color: active ? '#a5b4fc' : '#94a3b8',
                              fontWeight: active ? '700' : '500',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            {tipo}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Número de cuenta */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600' }}>
                        Número de Cuenta (20 dígitos)
                      </label>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        {cleanAccountNumber(paymentConfig['Transferencia Bancaria']?.numero_cuenta || '').length}/20 dígitos
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={23}
                      value={formatAccountNumber(cleanAccountNumber(paymentConfig['Transferencia Bancaria']?.numero_cuenta || ''))}
                      onChange={(e) => {
                        const cleaned = cleanAccountNumber(e.target.value);
                        const autoBank = findBankByAccount(cleaned, banks);
                        const currentBanco = paymentConfig['Transferencia Bancaria']?.banco;
                        const newBanco = !currentBanco && autoBank ? autoBank.code : currentBanco;

                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            numero_cuenta: cleaned,
                            ...(newBanco ? { banco: newBanco } : {}),
                          },
                        });
                        if (tbErrors.numero_cuenta) setTbErrors((prev) => ({ ...prev, numero_cuenta: null }));
                        if (autoBank && tbErrors.banco) setTbErrors((prev) => ({ ...prev, banco: null }));
                      }}
                      placeholder="0102 0000 00 0000000000"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: tbErrors.numero_cuenta ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.95rem',
                        fontFamily: 'monospace',
                        letterSpacing: '1px',
                        boxSizing: 'border-box',
                      }}
                    />
                    {tbErrors.numero_cuenta && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {tbErrors.numero_cuenta}
                      </span>
                    )}
                  </div>

                  {/* Titular */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Nombre del Titular
                    </label>
                    <input
                      type="text"
                      value={paymentConfig['Transferencia Bancaria']?.titular || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            titular: e.target.value,
                          },
                        });
                        if (tbErrors.titular) setTbErrors((prev) => ({ ...prev, titular: null }));
                      }}
                      placeholder="Nombre y Apellido o Razón Social"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: tbErrors.titular ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {tbErrors.titular && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {tbErrors.titular}
                      </span>
                    )}
                  </div>

                  {/* Documento del Titular */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Documento / RIF del Titular
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={paymentConfig['Transferencia Bancaria']?.tipo_doc || 'Persona'}
                        onChange={(e) => {
                          setPaymentConfig({
                            ...paymentConfig,
                            'Transferencia Bancaria': {
                              ...(paymentConfig['Transferencia Bancaria'] || {}),
                              tipo_doc: e.target.value,
                            },
                          });
                        }}
                        style={{
                          width: '85px',
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
                          <option key={d.key} value={d.key}>{d.prefix} - {d.key}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={paymentConfig['Transferencia Bancaria']?.cedula || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPaymentConfig({
                            ...paymentConfig,
                            'Transferencia Bancaria': {
                              ...(paymentConfig['Transferencia Bancaria'] || {}),
                              cedula: val,
                            },
                          });
                          if (tbErrors.cedula) setTbErrors((prev) => ({ ...prev, cedula: null }));
                        }}
                        placeholder="12345678"
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: '#1e293b',
                          border: tbErrors.cedula ? '1.5px solid #ef4444' : '1px solid #334155',
                          color: '#fff',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                    {tbErrors.cedula && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {tbErrors.cedula}
                      </span>
                    )}
                  </div>

                  {/* Correo Electrónico (Opcional) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Correo Electrónico (Opcional para comprobante)
                    </label>
                    <input
                      type="email"
                      value={paymentConfig['Transferencia Bancaria']?.email || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            email: e.target.value.trim(),
                          },
                        });
                        if (tbErrors.email) setTbErrors((prev) => ({ ...prev, email: null }));
                      }}
                      placeholder="correo@ejemplo.com"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: tbErrors.email ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {tbErrors.email && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {tbErrors.email}
                      </span>
                    )}
                  </div>
                </>
              )}

              {selectedConfigMethod === 'Efectivo USD' && (
                <>
                  {/* Tarjeta explicativa de Efectivo USD */}
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                      <Banknote size={17} /> Recepción de Dólares en Efectivo
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                      Ingresa los datos para que quienes te transfieran o aporten puedan coordinar la entrega física del dinero en mano de forma segura.
                    </p>
                  </div>

                  {/* Teléfono / WhatsApp */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Teléfono o WhatsApp para coordinar *
                    </label>
                    <input
                      type="text"
                      value={paymentConfig['Efectivo USD']?.telefono || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Efectivo USD': {
                            ...(paymentConfig['Efectivo USD'] || {}),
                            telefono: e.target.value,
                          },
                        });
                        if (usdErrors.telefono) setUsdErrors((prev) => ({ ...prev, telefono: null }));
                      }}
                      placeholder="Ej: 04141234567"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: usdErrors.telefono ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {usdErrors.telefono && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {usdErrors.telefono}
                      </span>
                    )}
                  </div>

                  {/* Lugar o Zona */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Lugar o Zona de Entrega de Preferencia *
                    </label>
                    <input
                      type="text"
                      value={paymentConfig['Efectivo USD']?.lugar || paymentConfig['Efectivo USD']?.zona_entrega || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Efectivo USD': {
                            ...(paymentConfig['Efectivo USD'] || {}),
                            lugar: e.target.value,
                          },
                        });
                        if (usdErrors.lugar) setUsdErrors((prev) => ({ ...prev, lugar: null }));
                      }}
                      placeholder="Ej: Chacao / C.C. Líder / Mi domicilio"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: usdErrors.lugar ? '1.5px solid #ef4444' : '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {usdErrors.lugar && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {usdErrors.lugar}
                      </span>
                    )}
                  </div>

                  {/* Horarios Disponibles */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Horario y Días Disponibles (Opcional)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      {CASH_USD_QUICK_SCHEDULES.map((sched) => {
                        const isCurrent = (paymentConfig['Efectivo USD']?.horario || '') === sched;
                        return (
                          <button
                            key={sched}
                            type="button"
                            onClick={() => {
                              setPaymentConfig({
                                ...paymentConfig,
                                'Efectivo USD': {
                                  ...(paymentConfig['Efectivo USD'] || {}),
                                  horario: isCurrent ? '' : sched,
                                },
                              });
                            }}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: isCurrent ? '1px solid #10b981' : '1px solid #334155',
                              backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: isCurrent ? '#6ee7b7' : '#94a3b8',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {sched}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={paymentConfig['Efectivo USD']?.horario || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Efectivo USD': {
                            ...(paymentConfig['Efectivo USD'] || {}),
                            horario: e.target.value,
                          },
                        });
                      }}
                      placeholder="O escribe un horario personalizado..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Condiciones de los Billetes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '2px', fontWeight: '600' }}>
                      Condiciones de los Billetes (Opcional)
                    </label>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '6px' }}>
                      Haz clic para activar o desactivar las políticas que exiges para recibir efectivo:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {CASH_USD_TYPICAL_CONDITIONS.map((cond) => {
                        const currentConds = Array.isArray(paymentConfig['Efectivo USD']?.condiciones)
                          ? paymentConfig['Efectivo USD'].condiciones
                          : [];
                        const isSelected = currentConds.includes(cond);
                        return (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => {
                              const nextConds = isSelected
                                ? currentConds.filter((c) => c !== cond)
                                : [...currentConds, cond];
                              setPaymentConfig({
                                ...paymentConfig,
                                'Efectivo USD': {
                                  ...(paymentConfig['Efectivo USD'] || {}),
                                  condiciones: nextConds,
                                },
                              });
                            }}
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

                  {/* Notas adicionales */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Notas o Instrucciones Adicionales (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={paymentConfig['Efectivo USD']?.notas || ''}
                      onChange={(e) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Efectivo USD': {
                            ...(paymentConfig['Efectivo USD'] || {}),
                            notas: e.target.value,
                          },
                        });
                      }}
                      placeholder="Ej: Confirmar antes de salir al punto de encuentro..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Botón de Confirmación para el método actual */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '1rem',
              borderTop: '1px solid #1e293b',
            }}>
              <button
                type="button"
                onClick={handleConfirmConfigMethod}
                style={{
                  width: '100%',
                  padding: '11px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
