import React, { useEffect, useState } from 'react';
import { membershipApi, useAuthStore } from '@civiccore/sdk';
import { Users, Search, Filter, UserPlus, Copy, Check, Sparkles, Share2 } from 'lucide-react';

const MembersList = () => {
  const { activeOrg, user } = useAuthStore();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal de invitación para fundador
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (activeOrg?.id) {
      fetchMembers();
    } else {
      setMembers([]);
      setIsLoading(false);
    }
  }, [activeOrg?.id]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.getMembers();
      const list = Array.isArray(data) ? data : [];
      const formatted = list.map(m => ({
        ...m,
        nombre: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.nombre || 'Miembro',
        email: m.email || '',
      }));
      setMembers(formatted);
    } catch (error) {
      console.warn("Could not fetch members:", error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!activeOrg?.id) return;
    setGeneratingInvite(true);
    setInviteError('');
    try {
      // Usar endpoint directo
      const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
        .toString().trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${rawApiUrl}/membership/organizations/${activeOrg.id}/invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Organization-ID': String(activeOrg.id),
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'No se pudo generar la invitación');
      }
      setInviteToken(data.token);
      setInviteCode(data.code || data.token);
      setShowInviteModal(true);
    } catch (err) {
      setInviteError(err?.message || 'Error al generar la invitación');
      alert(err?.message || 'Error al generar la invitación');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const inviteUrl = inviteToken ? `${window.location.origin}/invite?token=${encodeURIComponent(inviteToken)}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (_) {}
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.nombre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (m.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-semibold border border-green-500/30">Activo</span>;
      case 'pending':
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold border border-yellow-500/30">Pendiente</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-semibold border border-red-500/30">Suspendido</span>;
      case 'withdrawn':
        return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs font-semibold border border-gray-500/30">Retirado</span>;
      default:
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold border border-blue-500/30">{status}</span>;
    }
  };

  return (
    <div className="page-panel animate-fade-in pb-12" style={{ padding: '1.25rem 1rem' }}>
      {/* Título homologado con Android */}
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: '1.25rem',
      }}>
        Familia Mutual
      </h1>

      {!activeOrg ? (
        <div className="glass-card" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <Users size={36} className="text-muted mx-auto mb-3" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.5rem' }}>
            No tienes una mutual activa seleccionada
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '24rem', margin: '0 auto' }}>
            Selecciona tu mutual en la barra superior o ingresa tu código de invitación para ver a los miembros de tu familia.
          </p>
        </div>
      ) : (
        <>
          {/* Tarjeta Miembros Actuales */}
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.25rem',
            marginBottom: '1.25rem',
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#f8fafc',
              marginBottom: '1rem',
            }}>
              Miembros Actuales ({members.length})
            </h3>

            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}><div className="loader mx-auto" /></div>
            ) : members.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>No hay miembros que mostrar.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {members.map((member) => {
                  const isMe = (user?.id && member.id === user.id) ||
                               (user?.email && member.email?.toLowerCase() === user.email?.toLowerCase());
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.875rem',
                        backgroundColor: isMe ? 'rgba(59, 130, 246, 0.12)' : '#0f172a',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: isMe ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '21px',
                          backgroundColor: isMe ? '#2563eb' : '#3b82f6',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#ffffff',
                          fontWeight: '700',
                          fontSize: '1.1rem',
                          flexShrink: 0,
                        }}
                      >
                        {(member.first_name || member.nombre || 'U')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem', fontWeight: '700', color: isMe ? '#60a5fa' : '#f8fafc' }}>
                            {member.nombre}
                          </span>
                          {isMe && (
                            <span style={{
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              padding: '0.1rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              letterSpacing: '0.02em',
                            }}>
                              Tú
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                          {member.role === 'founder' ? 'Fundador' : 'Miembro'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tarjeta Invitar Miembros (Período de Gracia) para el Fundador */}
          {activeOrg?.role === 'founder' && (
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.25rem',
            }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                color: '#f8fafc',
                marginBottom: '0.5rem',
              }}>
                Invitar (Período de Gracia)
              </h3>
              <p style={{
                fontSize: '0.85rem',
                color: '#94a3b8',
                lineHeight: '1.45',
                marginBottom: '1rem',
              }}>
                Como fundador de la mutual, puedes invitar miembros directamente sin pasar por asamblea durante las primeras 24 horas.
              </p>

              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                color: '#bae6fd',
                lineHeight: '1.45'
              }}>
                <strong style={{ color: '#38bdf8' }}>Enlace único y personal: </strong>
                Cada invitación es de un solo uso para una sola persona. Si deseas invitar a varios familiares, genera un enlace para cada uno.
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                }}
                onClick={handleGenerateInvite}
                disabled={generatingInvite}
              >
                {generatingInvite ? 'Generando enlace...' : 'Compartir Enlace de Invitación'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal para compartir invitación */}
      {showInviteModal && (
        <div className="modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="glass-card p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-yellow-400" />
              ¡Invitación Creada!
            </h3>
            <p className="text-secondary text-xs mb-4">
              Comparte este enlace o código con tu familiar para que se una a {activeOrg?.name}:
            </p>

            <div className="bg-black/40 p-3 rounded-lg border border-white/10 mb-4">
              <span className="text-xs text-muted block mb-1">Código de invitación:</span>
              <strong className="text-lg text-blue-400 font-mono tracking-wider">{inviteCode}</strong>
            </div>

            <div style={{
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.78rem',
              color: '#bae6fd',
              lineHeight: '1.4'
            }}>
              <strong style={{ color: '#38bdf8' }}>Uso único por persona: </strong>
              Este enlace y código solo puede ser utilizado por un único familiar. Para otro miembro, genera una invitación nueva.
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="form-input text-xs flex-1 bg-black/30"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-primary text-xs flex items-center gap-1"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary w-full text-sm"
              onClick={() => setShowInviteModal(false)}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersList;
