import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';
import { OfflineEmptyState } from '../../components/Common/OfflineEmptyState.jsx';

export default function SelectMutual() {
  const navigate = useNavigate();
  const {
    user,
    organizations,
    expelledOrganizations,
    activeOrg,
    selectOrg,
    joinOrg,
    createOrg,
    logout,
    refreshUser,
    isOffline,
  } = useAuthStore();

  const envConfig = getEnvironmentConfig();
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // 'create' | 'join' | null

  // Join form state
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshUser();
      } catch (_) {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const expelledList = (() => {
    if (expelledOrganizations && expelledOrganizations.length > 0) return expelledOrganizations;
    if (user?.expelled_organizations && user.expelled_organizations.length > 0) return user.expelled_organizations;
    try {
      const raw = localStorage.getItem('cached_expelled_organizations');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  })();

  const handleSelectOrg = async (org) => {
    await selectOrg(org);
    navigate('/loans');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');
    try {
      const res = await joinOrg(inviteCode.trim());
      setJoinSuccess(res?.message || '¡Te has unido exitosamente!');
      setTimeout(() => {
        setModalMode(null);
        navigate('/loans');
      }, 1000);
    } catch (err) {
      setJoinError(err?.message || 'Código de invitación inválido o expirado');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Por favor ingresa un nombre para la mutual');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      await createOrg(createName.trim(), createDescription.trim());
      setCreateSuccess('¡Mutual creada exitosamente!');
      setTimeout(() => {
        setModalMode(null);
        navigate('/loans');
      }, 1000);
    } catch (err) {
      setCreateError(err?.message || 'No se pudo crear la mutual');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_) {}
    navigate('/login');
  };

  const accentColor = envConfig.color || '#10b981';
  const screenBg = envConfig.screenBg || '#06231c';
  const cardBg = envConfig.cardBg || '#0c332b';

  if (loading && !expelledList.length && (!organizations || organizations.length === 0)) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: screenBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: `3px solid ${accentColor}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: screenBg,
        boxSizing: 'border-box',
        padding: '20px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        maxWidth: '480px',
        margin: '0 auto',
        width: '100%',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div style={{ width: '100%' }}>
        {/* Title Row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            paddingTop: '10px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#f8fafc',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Mis Mutuales
          </h1>
          <EnvBadge size="small" />
        </div>

        {/* Aviso de Membresías Revocadas por la Asamblea */}
        {expelledList.length > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {expelledList.map((exp) => (
              <div
                key={exp.id}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '20px', marginTop: '2px', lineHeight: 1 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: '#f87171',
                      fontSize: '14px',
                      fontWeight: '700',
                      marginBottom: '4px',
                    }}
                  >
                    Membresía Revocada: {exp.name}
                  </div>
                  <div
                    style={{
                      color: '#cbd5e1',
                      fontSize: '12px',
                      lineHeight: '17px',
                    }}
                  >
                    La asamblea familiar ha aprobado la revocación de tu membresía en esta mutual. Tu acceso a sus datos y operaciones ha sido inhabilitado de forma definitiva.
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Listado de Mutuales Activas */}
        {organizations && organizations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>
            {organizations.map((org) => (
              <div
                key={org.id}
                onClick={() => handleSelectOrg(org)}
                style={{
                  backgroundColor: cardBg,
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '15px',
                  borderLeftWidth: '4px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: accentColor,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'opacity 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#f8fafc',
                    marginBottom: '5px',
                  }}
                >
                  {org.name}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                  }}
                >
                  Rol: {org.role === 'founder' ? 'Fundador' : 'Miembro'}
                </div>
              </div>
            ))}
          </div>
        ) : isOffline ? (
          <OfflineEmptyState
            title="Sin conexión de red"
            message="No se pudieron cargar tus mutuales. Tus datos están seguros y no se han eliminado. Por favor, intenta de nuevo cuando tengas conexión."
            onRetry={refreshUser}
            style={{ margin: '0 0 1.5rem 0' }}
          />
        ) : null}
      </div>

      {/* Estado Vacío: Centrado en el espacio disponible */}
      {(!organizations || organizations.length === 0) && !isOffline && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '20px 0',
          }}
        >
          <p
            style={{
              color: '#94a3b8',
              fontSize: '16px',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Aún no perteneces a ninguna familia/mutual.
          </p>
          <p
            style={{
              color: '#64748b',
              fontSize: '14px',
              textAlign: 'center',
              marginTop: '12px',
              lineHeight: '20px',
              padding: '0 10px',
            }}
          >
            Si alguien te invitó, toca "Tengo un código de invitación" y escribe el código que aparece en tu mensaje.
          </p>
        </div>
      )}

      {/* Acciones Inferiores Homologadas */}
      <div
        style={{
          marginTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={() => setModalMode('join')}
          style={{
            backgroundColor: accentColor,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px',
            padding: '15px',
            borderRadius: '8px',
            alignItems: 'center',
            marginBottom: '12px',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            display: 'block',
            boxSizing: 'border-box',
          }}
        >
          Tengo un código de invitación
        </button>

        <button
          type="button"
          onClick={() => setModalMode('create')}
          style={{
            backgroundColor: 'transparent',
            borderColor: accentColor,
            borderWidth: '1px',
            borderStyle: 'solid',
            padding: '15px',
            borderRadius: '8px',
            alignItems: 'center',
            marginBottom: '20px',
            color: accentColor,
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            display: 'block',
            boxSizing: 'border-box',
          }}
        >
          Crear una nueva mutual
        </button>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            padding: '15px',
            alignItems: 'center',
            color: '#ef4444',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            display: 'block',
            boxSizing: 'border-box',
          }}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Modal / Dialog para Crear o Unirse (Homologados con Android) */}
      {modalMode && (
        <div
          onClick={() => setModalMode(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: cardBg,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxSizing: 'border-box',
              color: '#f8fafc',
            }}
          >
            {modalMode === 'create' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
                    Crear mi Mutual
                  </h3>
                  <EnvBadge size="small" />
                </div>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: '20px' }}>
                  Inicia tu propia familia y administra sus préstamos y fondos.
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <p style={{ fontSize: '12px', color: '#f59e0b', margin: 0, lineHeight: '18px' }}>
                    📌 Cada miembro de la mutual inicial puede crear hasta 1 mutual adicional. Si deseas desplegar tu propia instancia o bot, contáctanos por soporte.
                  </p>
                </div>

                <form onSubmit={handleCreate}>
                  <div style={{ marginBottom: '14px' }}>
                    <input
                      type="text"
                      placeholder="Nombre de la familia (ej. Familia Pérez)"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        backgroundColor: '#071318',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        padding: '14px',
                        color: '#f8fafc',
                        fontSize: '15px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <textarea
                      rows={3}
                      placeholder="Descripción (Opcional)"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#071318',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        padding: '14px',
                        color: '#f8fafc',
                        fontSize: '15px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>
                  {createError && (
                    <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
                      {createError}
                    </div>
                  )}
                  {createSuccess && (
                    <div style={{ color: '#10b981', fontSize: '13px', marginBottom: '12px' }}>
                      {createSuccess}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="submit"
                      disabled={createLoading || !createName.trim()}
                      style={{
                        backgroundColor: accentColor,
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        padding: '14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: createLoading || !createName.trim() ? 'not-allowed' : 'pointer',
                        opacity: createLoading || !createName.trim() ? 0.6 : 1,
                      }}
                    >
                      {createLoading ? 'Creando...' : 'Crear Mutual'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#94a3b8',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        padding: '12px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
                    Unirse a una Mutual
                  </h3>
                  <EnvBadge size="small" />
                </div>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: '20px' }}>
                  Ingresa el código de 8 caracteres que aparece en tu invitación (ej. K7P3-QX9M) o el enlace completo.
                </p>
                <form onSubmit={handleJoin}>
                  <div style={{ marginBottom: '16px' }}>
                    <input
                      type="text"
                      placeholder="Código o enlace de invitación"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        backgroundColor: '#071318',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        padding: '14px',
                        color: '#f8fafc',
                        fontSize: '15px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                  {joinError && (
                    <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
                      {joinError}
                    </div>
                  )}
                  {joinSuccess && (
                    <div style={{ color: '#10b981', fontSize: '13px', marginBottom: '12px' }}>
                      {joinSuccess}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="submit"
                      disabled={joinLoading || !inviteCode.trim()}
                      style={{
                        backgroundColor: accentColor,
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        padding: '14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: joinLoading || !inviteCode.trim() ? 'not-allowed' : 'pointer',
                        opacity: joinLoading || !inviteCode.trim() ? 0.6 : 1,
                      }}
                    >
                      {joinLoading ? 'Uniendo...' : 'Unirme a la mutual'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#94a3b8',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        padding: '12px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
