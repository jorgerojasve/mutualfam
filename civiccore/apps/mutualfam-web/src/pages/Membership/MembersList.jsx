import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { membershipApi, asambleasApi, useAuthStore } from '@civiccore/sdk';
import { Users, Search, Filter, UserPlus, Copy, Check, Sparkles, Share2, Landmark, CheckCircle, XCircle, AlertCircle, Clock, ShieldAlert, Vote, X } from 'lucide-react';
import { OfflineEmptyState, OfflineNoticeBanner } from '../../components/Common/OfflineEmptyState.jsx';

const MembersList = () => {
  const { activeOrg, user, isOffline } = useAuthStore();
  const [activeMainTab, setActiveMainTab] = useState('miembros'); // 'miembros' | 'asamblea'

  // Miembros State
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Asambleas State
  const [propuestas, setPropuestas] = useState([]);
  const [isLoadingAsambleas, setIsLoadingAsambleas] = useState(true);
  const [asambleaFilter, setAsambleaFilter] = useState('activas'); // 'activas' | 'historial'
  const [expulsables, setExpulsables] = useState([]);

  // Modales de Asamblea
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showExpulsionModal, setShowExpulsionModal] = useState(false);
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [selectedPropuesta, setSelectedPropuesta] = useState(null);

  // Form: Proponer Ingreso
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateMotive, setCandidateMotive] = useState('');
  const [submittingIngreso, setSubmittingIngreso] = useState(false);

  // Form: Proponer Expulsión
  const [targetMemberId, setTargetMemberId] = useState('');
  const [expulsionMotive, setExpulsionMotive] = useState('');
  const [submittingExpulsion, setSubmittingExpulsion] = useState(false);

  // Form: Publicar Defensa
  const [defenseText, setDefenseText] = useState('');
  const [submittingDefense, setSubmittingDefense] = useState(false);

  // Cargar Miembros
  const fetchMembers = async () => {
    if (!activeOrg?.id) {
      setMembers([]);
      setIsLoadingMembers(false);
      return;
    }
    try {
      setIsLoadingMembers(true);
      setConnectionError(false);
      const data = await membershipApi.getMembers();
      const list = Array.isArray(data) ? data : [];
      const formatted = list.map(m => ({
        ...m,
        nombre: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.nombre || 'Miembro',
        email: m.email || '',
      }));
      setMembers(formatted);
      try {
        localStorage.setItem(`cached_members_${activeOrg.id}`, JSON.stringify(formatted));
      } catch (_) {}
    } catch (error) {
      console.warn("Could not fetch members:", error);
      const isNet = !error?.response && (
        Boolean(error?.request) ||
        Boolean(error?.message && (
          error.message.includes('Network Error') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')
        ))
      );
      if (isNet) {
        setConnectionError(true);
        try {
          const cached = localStorage.getItem(`cached_members_${activeOrg.id}`);
          if (cached) setMembers(JSON.parse(cached));
        } catch (_) {}
      }
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Cargar Propuestas de Asamblea
  const fetchPropuestas = async () => {
    if (!activeOrg?.id) {
      setPropuestas([]);
      setIsLoadingAsambleas(false);
      return;
    }
    try {
      setIsLoadingAsambleas(true);
      setConnectionError(false);
      const data = await asambleasApi.getPropuestas();
      const list = Array.isArray(data) ? data : [];
      setPropuestas(list);
      try {
        localStorage.setItem(`cached_asambleas_${activeOrg.id}`, JSON.stringify(list));
      } catch (_) {}
    } catch (error) {
      console.warn("Could not fetch propuestas:", error);
      const isNet = !error?.response && (
        Boolean(error?.request) ||
        Boolean(error?.message && (
          error.message.includes('Network Error') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')
        ))
      );
      if (isNet) {
        setConnectionError(true);
        try {
          const cached = localStorage.getItem(`cached_asambleas_${activeOrg.id}`);
          if (cached) setPropuestas(JSON.parse(cached));
        } catch (_) {}
      }
    } finally {
      setIsLoadingAsambleas(false);
    }
  };

  // Cargar miembros expulsables (excluyendo al fundador y a uno mismo)
  const fetchExpulsables = async () => {
    try {
      const data = await asambleasApi.getMiembrosExpulsables();
      if (Array.isArray(data)) {
        setExpulsables(data);
      }
    } catch (_) {
      setExpulsables([]);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchPropuestas();
  }, [activeOrg?.id]);

  const handleRetryAll = async () => {
    await Promise.all([fetchMembers(), fetchPropuestas()]);
  };

  // Generar Invitación de Período de Gracia
  const handleGenerateInvite = async () => {
    if (!activeOrg?.id) return;
    setGeneratingInvite(true);
    try {
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

  // Proponer Ingreso
  const handleProponerIngreso = async (e) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim() || !candidateMotive.trim()) {
      alert('Por favor completa todos los campos del candidato');
      return;
    }
    setSubmittingIngreso(true);
    try {
      await asambleasApi.proponerIngreso({
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail.trim(),
        motive: candidateMotive.trim()
      });
      setShowIngresoModal(false);
      setCandidateName('');
      setCandidateEmail('');
      setCandidateMotive('');
      await fetchPropuestas();
      alert('¡Propuesta de admisión creada! Se ha abierto el período de deliberación de 15 días en la asamblea familiar.');
    } catch (err) {
      alert(err.message || 'Error al proponer ingreso');
    } finally {
      setSubmittingIngreso(false);
    }
  };

  // Proponer Expulsión
  const handleProponerExpulsion = async (e) => {
    e.preventDefault();
    if (!targetMemberId || !expulsionMotive.trim()) {
      alert('Por favor selecciona el miembro y describe el motivo de expulsión');
      return;
    }
    setSubmittingExpulsion(true);
    try {
      await asambleasApi.proponerExpulsion({
        target_member_id: parseInt(targetMemberId, 10),
        motive: expulsionMotive.trim()
      });
      setShowExpulsionModal(false);
      setTargetMemberId('');
      setExpulsionMotive('');
      await fetchPropuestas();
      alert('¡Propuesta de expulsión registrada para debate en la asamblea familiar!');
    } catch (err) {
      alert(err.message || 'Error al proponer expulsión');
    } finally {
      setSubmittingExpulsion(false);
    }
  };

  // Votar en Asamblea
  const handleVote = async (proposalId, voteValue) => {
    const confirmMsg = voteValue === 'veto'
      ? '⚠️ ¿Confirmas tu VETO a esta propuesta? Cualquier veto desaprueba la propuesta inmediatamente según el pacto familiar.'
      : `¿Deseas emitir tu voto "${voteValue === 'for' ? 'A Favor' : 'Abstención'}"?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      await asambleasApi.votar(proposalId, voteValue);
      await fetchPropuestas();
      alert('¡Tu voto fue registrado exitosamente!');
    } catch (err) {
      alert(err.message || 'Error al emitir voto');
    }
  };

  // Publicar Defensa
  const handlePublicarDefensa = async (e) => {
    e.preventDefault();
    if (!selectedPropuesta || !defenseText.trim()) return;
    setSubmittingDefense(true);
    try {
      await asambleasApi.publicarDefensa(selectedPropuesta.id, defenseText.trim());
      setShowDefenseModal(false);
      setDefenseText('');
      setSelectedPropuesta(null);
      await fetchPropuestas();
      alert('Tu alegato de defensa ha sido publicado ante la asamblea familiar.');
    } catch (err) {
      alert(err.message || 'Error al publicar defensa');
    } finally {
      setSubmittingDefense(false);
    }
  };

  // Concluir Propuesta
  const handleCerrarPropuesta = async (proposalId) => {
    if (!window.confirm('¿Deseas evaluar el quórum y dar por concluida esta asamblea familiar?')) return;
    try {
      await asambleasApi.cerrarPropuesta(proposalId);
      await fetchPropuestas();
      alert('Asamblea concluida y resolución registrada.');
    } catch (err) {
      alert(err.message || 'No se pudo cerrar la propuesta');
    }
  };

  // Filtrar propuestas
  const activeProposals = propuestas.filter(p => p.status === 'DEBATE' || p.status === 'VOTING');
  const historyProposals = propuestas.filter(p => p.status === 'APPROVED' || p.status === 'REJECTED' || p.status === 'CLOSED');
  const displayedPropuestas = asambleaFilter === 'activas' ? activeProposals : historyProposals;

  return (
    <div className="page-panel animate-fade-in pb-12" style={{ padding: '1.25rem 1rem' }}>
      {/* Cabecera Principal */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
            Familia Mutual
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Comunidad de miembros, asambleas soberanas y acuerdos familiares
          </p>
        </div>

        {activeMainTab === 'asamblea' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowIngresoModal(true)}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)',
              }}
            >
              <UserPlus size={15} />
              + Proponer Ingreso
            </button>
            <button
              type="button"
              onClick={() => {
                fetchExpulsables();
                setShowExpulsionModal(true);
              }}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldAlert size={15} />
              Proponer Expulsión
            </button>
          </div>
        )}
      </div>

      {/* Control Segmentado de Sub-pestañas: Miembros vs Asambleas (Homologado con Móvil) */}
      <div style={{
        display: 'flex',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.5rem',
      }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('miembros')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'miembros' ? '#2563eb' : 'transparent',
            color: activeMainTab === 'miembros' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          👥 Miembros ({members.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('asamblea')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'asamblea' ? '#10b981' : 'transparent',
            color: activeMainTab === 'asamblea' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🏛️ Asamblea {activeProposals.length > 0 ? `(${activeProposals.length})` : ''}
        </button>
      </div>

      {(isOffline || connectionError) && (
        <OfflineNoticeBanner
          message="Sin conexión de red · Mostrando datos locales guardados"
          onRetry={handleRetryAll}
        />
      )}

      {/* ========================================================= */}
      {/* VISTA 1: MIEMBROS ACTUALES                                */}
      {/* ========================================================= */}
      {activeMainTab === 'miembros' && (
        <div>
          {!activeOrg ? (
            <div className="glass-card" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <Users size={36} className="text-muted mx-auto mb-3" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.5rem' }}>
                No tienes una mutual activa seleccionada
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '24rem', margin: '0 auto' }}>
                Selecciona tu mutual en la barra superior para ver a los miembros de tu familia.
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

                {isLoadingMembers ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}><div className="loader mx-auto" /></div>
                ) : members.length === 0 ? (
                  (isOffline || connectionError) ? (
                    <OfflineEmptyState
                      title="Sin conexión de red"
                      message="No se pudieron cargar los miembros de la mutual. Tus datos están seguros."
                      onRetry={fetchMembers}
                    />
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>No hay miembros que mostrar.</p>
                  )
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

              {/* Tarjeta Invitar Miembros */}
              <div style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.5rem' }}>
                  Invitar Nuevo Miembro a la Mutual
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.45', marginBottom: '1rem' }}>
                  Durante las primeras 24 horas (período de gracia), el fundador puede invitar directamente. Concluida esa etapa, los ingresos se procesan mediante <strong>Asamblea Familiar (15 días de deliberación con regla de consenso y veto nominativo)</strong>.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {activeOrg?.role === 'founder' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                      }}
                      onClick={handleGenerateInvite}
                      disabled={generatingInvite}
                    >
                      {generatingInvite ? 'Generando...' : 'Generar Invitación Directa'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.75rem 1.25rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      borderColor: '#10b981',
                      color: '#10b981',
                    }}
                    onClick={() => {
                      setActiveMainTab('asamblea');
                      setShowIngresoModal(true);
                    }}
                  >
                    + Proponer Ingreso en Asamblea
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: ASAMBLEAS FAMILIARES (GOBERNANZA)                 */}
      {/* ========================================================= */}
      {activeMainTab === 'asamblea' && (
        <div>
          {/* Subfiltro Activas vs Historial */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setAsambleaFilter('activas')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: asambleaFilter === 'activas' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: asambleaFilter === 'activas' ? '#10b981' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              En Curso ({activeProposals.length})
            </button>
            <button
              type="button"
              onClick={() => setAsambleaFilter('historial')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: asambleaFilter === 'historial' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: asambleaFilter === 'historial' ? '#60a5fa' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Historial Concluido ({historyProposals.length})
            </button>
          </div>

          {isLoadingAsambleas ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '14rem' }}>
              <div className="loader" />
            </div>
          ) : displayedPropuestas.length === 0 ? (
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar las propuestas de asamblea. Tus datos están seguros."
                onRetry={fetchPropuestas}
              />
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}>
                <Landmark size={48} className="text-muted mx-auto mb-3" style={{ opacity: 0.5 }} />
                <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                  No hay asambleas {asambleaFilter === 'activas' ? 'en curso' : 'en el historial'}
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.875rem', lineHeight: '1.5' }}>
                  Las decisiones de incorporación tras las primeras 24h y de expulsión se debaten en asamblea por 15 días con regla de consenso (75% de aceptación y 0 vetos).
                </p>
                {asambleaFilter === 'activas' && (
                  <button
                    type="button"
                    onClick={() => setShowIngresoModal(true)}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Proponer Ingreso de Familiar
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="dashboard-grid">
              {displayedPropuestas.map((p) => {
                const isAdmission = p.proposal_type === 'ADMISSION' || p.category === 'ADMISSION';
                const isExpulsion = p.proposal_type === 'EXPULSION' || p.category === 'EXPULSION';
                const votesFor = p.votes_for || p.tally?.for || 0;
                const votesAgainst = p.votes_against || p.tally?.against || 0;
                const votesVeto = p.votes_veto || p.tally?.veto || 0;
                const totalVotes = (votesFor + votesAgainst + votesVeto) || 1;
                const forPct = Math.round((votesFor / totalVotes) * 100);

                const isTarget = user && (p.target_member_id === user.id);
                const hasVoted = p.user_voted || p.mi_voto;

                return (
                  <div
                    key={p.id}
                    className="glass-card"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.875rem',
                    }}
                  >
                    {/* Header de la Propuesta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: isAdmission ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: isAdmission ? '#34d399' : '#f87171',
                            border: `1px solid ${isAdmission ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}>
                            {isAdmission ? '🏛️ Admisión' : '🛡️ Expulsión'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {p.days_remaining != null ? `Quedan ${p.days_remaining} días` : 'Plazo de 15 días'}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                          {p.title || (isAdmission ? `Ingreso de ${p.candidate_name || 'Nuevo Familiar'}` : `Expulsión de ${p.target_member_name || 'Miembro'}`)}
                        </h3>
                      </div>

                      {/* Pill de Estado */}
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        backgroundColor: p.status === 'APPROVED' ? '#10b981' : p.status === 'REJECTED' ? '#ef4444' : '#3b82f6',
                        color: '#ffffff',
                      }}>
                        {p.status === 'APPROVED' ? 'Aprobada' : p.status === 'REJECTED' ? 'Rechazada / Vetada' : 'En Deliberación'}
                      </span>
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
                      {p.description || p.motive || 'Deliberación familiar para decisión soberana.'}
                    </p>

                    {/* Veto Alert si hubo veto */}
                    {votesVeto > 0 && (
                      <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        color: '#fca5a5',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <ShieldAlert size={16} />
                        <span><strong>Veto Nominativo Ejercido:</strong> La propuesta ha sido bloqueada.</span>
                      </div>
                    )}

                    {/* Barra de Votación y Reglas */}
                    <div style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      padding: '0.875rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>Aprobación Actual</span>
                        <span style={{ color: '#f8fafc', fontWeight: '700' }}>{forPct}% (Mínimo 75%)</span>
                      </div>

                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: '#334155',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}>
                        <div style={{
                          width: `${forPct}%`,
                          height: '100%',
                          backgroundColor: forPct >= 75 && votesVeto === 0 ? '#10b981' : '#f59e0b',
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}>
                        <span>👍 {votesFor} A Favor</span>
                        <span>🚫 {votesVeto} Vetos</span>
                        <span>⚪ {votesAgainst} En Contra</span>
                      </div>
                    </div>

                    {/* Alegato de Defensa en caso de Expulsión */}
                    {p.defense_text && (
                      <div style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        color: '#93c5fd',
                      }}>
                        <strong>Alegato de Defensa del Imputado:</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#e2e8f0' }}>{p.defense_text}</p>
                      </div>
                    )}

                    {/* Botonera de Votación y Acciones */}
                    {(p.status === 'DEBATE' || p.status === 'VOTING') && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingTop: '0.75rem',
                        marginTop: 'auto',
                      }}>
                        {!hasVoted ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            <button
                              type="button"
                              style={{
                                padding: '8px 4px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleVote(p.id, 'for')}
                            >
                              👍 A Favor
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '8px 4px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleVote(p.id, 'veto')}
                            >
                              🚫 Veto
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '8px 4px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#475569',
                                color: '#ffffff',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleVote(p.id, 'abstain')}
                            >
                              ⚪ Abstención
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#34d399', textAlign: 'center', fontWeight: '600' }}>
                            ✓ Ya has emitido tu voto en esta asamblea
                          </div>
                        )}

                        {/* Publicar defensa si es el objetivo de expulsión y no ha publicado */}
                        {isExpulsion && isTarget && !p.defense_text && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', borderColor: '#3b82f6', color: '#60a5fa' }}
                            onClick={() => {
                              setSelectedPropuesta(p);
                              setShowDefenseModal(true);
                            }}
                          >
                            ✍️ Publicar mi Defensa ante la Asamblea
                          </button>
                        )}

                        {/* Concluir Asamblea */}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', color: '#94a3b8' }}
                          onClick={() => handleCerrarPropuesta(p.id)}
                        >
                          Concluir / Registrar Resolución
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: COMPARTIR INVITACIÓN (PERÍODO DE GRACIA)        */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 2: PROPONER INGRESO EN ASAMBLEA                     */}
      {/* ========================================================= */}
      {showIngresoModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowIngresoModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '26rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>🏛️ Proponer Ingreso a la Mutual</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowIngresoModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Se someterá a deliberación familiar durante 15 días. Requiere un mínimo del 75% de aceptación y ningún veto.
            </p>

            <form onSubmit={handleProponerIngreso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Nombre y Apellido del Familiar *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: Carmen Salazar"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="familiar@correo.com"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Parentesco / Justificación *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Explica el grado de parentesco o afinidad con la familia y por qué se propone su ingreso"
                  value={candidateMotive}
                  onChange={(e) => setCandidateMotive(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowIngresoModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981', border: 'none' }}
                  disabled={submittingIngreso}
                >
                  {submittingIngreso ? 'Procesando...' : 'Iniciar Asamblea (15 días)'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PROPONER EXPULSIÓN                               */}
      {/* ========================================================= */}
      {showExpulsionModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowExpulsionModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '26rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#f87171' }}>🛡️ Proponer Expulsión de Miembro</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowExpulsionModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              El miembro propuesto tendrá derecho a publicar su defensa. Cualquier veto anula la expulsión.
            </p>

            <form onSubmit={handleProponerExpulsion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Seleccionar Miembro *
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un miembro...</option>
                  {(expulsables.length > 0 ? expulsables : members.filter(m => m.id !== user?.id && m.role !== 'founder')).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre || `${m.first_name || ''} ${m.last_name || ''}`.trim()} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Motivo y Justificación de la Expulsión *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Describe de forma fundamentada las causas que motivan la propuesta"
                  value={expulsionMotive}
                  onChange={(e) => setExpulsionMotive(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowExpulsionModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#ef4444', border: 'none' }}
                  disabled={submittingExpulsion}
                >
                  {submittingExpulsion ? 'Procesando...' : 'Iniciar Proceso de Asamblea'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 4: PUBLICAR DEFENSA ANTE ASAMBLEA                   */}
      {/* ========================================================= */}
      {showDefenseModal && selectedPropuesta && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowDefenseModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '26rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>✍️ Tu Alegato de Defensa</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowDefenseModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Escribe aquí tus descargos o razones para que toda la familia los lea antes de emitir su voto.
            </p>

            <form onSubmit={handlePublicarDefensa} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <textarea
                  className="form-input"
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Expresa tus descargos de forma respetuosa..."
                  value={defenseText}
                  onChange={(e) => setDefenseText(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDefenseModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#2563eb', border: 'none' }}
                  disabled={submittingDefense}
                >
                  {submittingDefense ? 'Publicando...' : 'Publicar Defensa'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MembersList;
