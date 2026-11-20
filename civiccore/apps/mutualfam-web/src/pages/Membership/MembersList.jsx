import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { membershipApi, asambleasApi, useAuthStore, eventBus } from '@civiccore/sdk';
import { Users, Search, Filter, UserPlus, Copy, Check, Sparkles, Share2, Landmark, CheckCircle, XCircle, AlertCircle, Clock, ShieldAlert, Vote, X, RefreshCw, Send, MessageCircle } from 'lucide-react';
import { OfflineEmptyState, OfflineNoticeBanner } from '../../components/Common/OfflineEmptyState.jsx';

const MembersList = () => {
  const { activeOrg, user, isOffline } = useAuthStore();
  const [activeMainTab, setActiveMainTab] = useState('miembros'); // 'miembros' | 'asamblea'

  // Lectura segura de caché inicial para evitar parpadeos de conteo en 0
  const getInitialCached = (prefix) => {
    try {
      const orgId = activeOrg?.id || localStorage.getItem('active_org_id') || localStorage.getItem('organizationId');
      if (orgId) {
        const cached = localStorage.getItem(`${prefix}_${orgId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (_) {}
    return null;
  };

  // Miembros State
  const initialCachedMembers = getInitialCached('cached_members');
  const [members, setMembers] = useState(initialCachedMembers || []);
  const [hasLoadedMembers, setHasLoadedMembers] = useState(Boolean(initialCachedMembers));
  const [isLoadingMembers, setIsLoadingMembers] = useState(!initialCachedMembers);
  const [connectionError, setConnectionError] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Asambleas State
  const initialCachedAsambleas = getInitialCached('cached_asambleas');
  const [propuestas, setPropuestas] = useState(initialCachedAsambleas || []);
  const [hasLoadedAsambleas, setHasLoadedAsambleas] = useState(Boolean(initialCachedAsambleas));
  const [isLoadingAsambleas, setIsLoadingAsambleas] = useState(!initialCachedAsambleas);
  const [asambleaFilter, setAsambleaFilter] = useState('activas'); // 'activas' | 'historial'
  const [expulsables, setExpulsables] = useState([]);

  // Modales de Asamblea
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showExpulsionModal, setShowExpulsionModal] = useState(false);
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [selectedPropuesta, setSelectedPropuesta] = useState(null);
  const [throttleStatus, setThrottleStatus] = useState(null);

  // Modal Detalle de Propuesta y Debate (Homologado con Móvil)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVotingRules, setShowVotingRules] = useState(false);
  const [proposalDetail, setProposalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentStance, setCommentStance] = useState('opinión');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [closingProposal, setClosingProposal] = useState(false);
  const [defenseInput, setDefenseInput] = useState('');
  const commentInputRef = useRef(null);

  // Form: Proponer Ingreso
  const [candidateName, setCandidateName] = useState('');
  const [candidateRelation, setCandidateRelation] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateMotive, setCandidateMotive] = useState('');
  const [submittingIngreso, setSubmittingIngreso] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  // Form: Proponer Expulsión
  const [targetMemberId, setTargetMemberId] = useState('');
  const [expulsionMotive, setExpulsionMotive] = useState('');
  const [submittingExpulsion, setSubmittingExpulsion] = useState(false);

  // Form: Publicar Defensa
  const [defenseText, setDefenseText] = useState('');
  const [submittingDefense, setSubmittingDefense] = useState(false);

  // Formateador de tiempo restante homologado con móvil
  const formatRemainingTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '';
    if (seconds <= 0) return 'Plazo concluido';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (d > 0) {
      return h > 0 ? `${d}d ${h}h restantes` : `${d}d restantes`;
    }
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m restantes` : `${h}h restantes`;
    }
    return `${Math.max(1, m)}m restantes`;
  };

  // Cargar Miembros
  const fetchMembers = async (silent = false) => {
    if (!activeOrg?.id) {
      setMembers([]);
      setIsLoadingMembers(false);
      setHasLoadedMembers(true);
      return;
    }
    try {
      if (!silent) setIsLoadingMembers(true);
      setConnectionError(false);
      const data = await membershipApi.getMembers();
      const list = Array.isArray(data) ? data : [];
      const formatted = list.map(m => ({
        ...m,
        nombre: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.nombre || 'Miembro',
        email: m.email || '',
      }));
      setMembers(formatted);
      setHasLoadedMembers(true);
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
      if (!silent) setIsLoadingMembers(false);
      setHasLoadedMembers(true);
    }
  };

  // Cargar Propuestas de Asamblea
  const fetchPropuestas = async (silent = false) => {
    if (!activeOrg?.id) {
      setPropuestas([]);
      setIsLoadingAsambleas(false);
      setHasLoadedAsambleas(true);
      return;
    }
    try {
      if (!silent) setIsLoadingAsambleas(true);
      setConnectionError(false);
      const data = await asambleasApi.getPropuestas();
      const list = Array.isArray(data) ? data : [];
      setPropuestas(list);
      setHasLoadedAsambleas(true);

      // Consultar estado de enfriamiento y límites de propuestas
      asambleasApi.getThrottleStatus().then(st => setThrottleStatus(st)).catch(() => {});
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
      if (!silent) setIsLoadingAsambleas(false);
      setHasLoadedAsambleas(true);
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
    if (activeOrg?.id) {
      try {
        const cachedM = localStorage.getItem(`cached_members_${activeOrg.id}`);
        if (cachedM) {
          const parsed = JSON.parse(cachedM);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed);
            setHasLoadedMembers(true);
          }
        }
        const cachedA = localStorage.getItem(`cached_asambleas_${activeOrg.id}`);
        if (cachedA) {
          const parsed = JSON.parse(cachedA);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPropuestas(parsed);
            setHasLoadedAsambleas(true);
          }
        }
      } catch (_) {}
    }
    fetchMembers();
    fetchPropuestas();
  }, [activeOrg?.id]);

  // Suscripción WebSocket en vivo a eventos de gobernanza y membresía
  useEffect(() => {
    if (!activeOrg?.id) return;

    const handleRealtimeUpdate = (payload) => {
      fetchPropuestas(true);
      fetchMembers(true);
      if (proposalDetail && payload?.proposal_id === proposalDetail.id) {
        asambleasApi.getPropuesta(proposalDetail.id).then(updated => {
          if (updated) setProposalDetail(updated);
        }).catch(() => {});
        asambleasApi.getComentarios(proposalDetail.id).then(updatedComments => {
          if (updatedComments) setComments(updatedComments);
        }).catch(() => {});
      }
    };

    const unsubs = [
      eventBus.subscribe('PROPUESTA_CREADA', handleRealtimeUpdate),
      eventBus.subscribe('PROPUESTA_APROBADA', handleRealtimeUpdate),
      eventBus.subscribe('PROPUESTA_ACTUALIZADA', handleRealtimeUpdate),
      eventBus.subscribe('PROPUESTA_RESUELTA', handleRealtimeUpdate),
      eventBus.subscribe('VOTO_EMITIDO', handleRealtimeUpdate),
      eventBus.subscribe('DEFENSA_PUBLICADA', handleRealtimeUpdate),
      eventBus.subscribe('PROPUESTA_COMENTADA', handleRealtimeUpdate),
      eventBus.subscribe('MIEMBRO_INGRESADO', handleRealtimeUpdate),
      eventBus.subscribe('RECONNECTED', handleRealtimeUpdate),
    ];

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [activeOrg?.id, proposalDetail?.id]);

  // Polling silencioso de comentarios mientras esté abierto el modal de detalle
  const fetchCommentsSilent = async (propId) => {
    try {
      const list = await asambleasApi.getComentarios(propId);
      if (Array.isArray(list)) {
        setComments((prev) => {
          if (
            list.length !== prev.length ||
            list.some((item, idx) => item.id !== prev[idx]?.id || item.content !== prev[idx]?.content)
          ) {
            return list;
          }
          return prev;
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    let interval = null;
    if (showDetailModal && proposalDetail?.id) {
      interval = setInterval(() => {
        fetchCommentsSilent(proposalDetail.id);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDetailModal, proposalDetail?.id]);

  const handleRetryAll = async () => {
    await Promise.all([fetchMembers(), fetchPropuestas()]);
  };

  // Abrir Modal de Detalle de Asamblea
  const openProposalDetail = async (proposal) => {
    setSelectedPropuesta(proposal);
    setShowDetailModal(true);
    setShowVotingRules(false);
    setLoadingDetail(true);
    setCommentText('');
    setReplyingTo(null);
    try {
      const [full, commentList] = await Promise.all([
        asambleasApi.getPropuesta(proposal.id),
        asambleasApi.getComentarios(proposal.id).catch(() => [])
      ]);
      setProposalDetail(full);
      setDefenseInput(full.defense_text || '');
      setComments(commentList);
    } catch (e) {
      alert(e?.message || 'No se pudo cargar el detalle de la propuesta');
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Responder a un autor específico con mención @
  const handleReplyToAuthor = (authorName) => {
    if (!authorName) return;
    const cleanName = authorName.trim();
    const mention = `@${cleanName} `;
    setReplyingTo(cleanName);
    setCommentText((prev) => {
      if (prev.includes(`@${cleanName}`)) return prev;
      return prev ? `${mention}${prev}` : mention;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 150);
  };

  // Publicar Comentario en el Foro de Debate
  const handleSendComment = async (e) => {
    if (e) e.preventDefault();
    if (!proposalDetail) return;
    const text = commentText.trim();
    if (!text) {
      alert('Por favor escribe tu opinión o argumento');
      return;
    }
    setSubmittingComment(true);
    try {
      await asambleasApi.agregarComentario(proposalDetail.id, {
        content: text,
        stance: commentStance
      });
      setCommentText('');
      setReplyingTo(null);
      const updated = await asambleasApi.getComentarios(proposalDetail.id);
      setComments(updated);
    } catch (err) {
      alert(err?.message || 'Error al publicar comentario');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Emitir Voto en el Modal de Detalle
  const handleVotarInDetail = async (voto) => {
    if (!proposalDetail) return;
    const isExpulsion = proposalDetail.proposal_type === 'expulsion' || proposalDetail.proposal_type === 'member_expulsion' || proposalDetail.category === 'EXPULSION';

    let confirmMsg = `¿Deseas registrar tu voto como "${voto.toUpperCase()}"?`;
    if (isExpulsion) {
      if (voto === 'si') {
        confirmMsg = '⚠️ ATENCIÓN: Estás a punto de votar a favor de EXPULSAR al miembro de la mutual familiar. ¿Confirmas tu voto?';
      } else if (voto === 'no') {
        confirmMsg = '🛡️ Estás votando en contra de la expulsión para MANTENER al miembro en la mutual familiar. ¿Confirmas tu voto?';
      } else {
        confirmMsg = '⬜ ¿Deseas registrar tu voto como ABSTENCIÓN en esta propuesta de expulsión?';
      }
    } else if (voto === 'no' && (proposalDetail.proposal_type === 'member_admission' || proposalDetail.category === 'ADMISSION')) {
      confirmMsg = '⚠️ ATENCIÓN: Un voto en contra (NO) en una propuesta de ingreso activará el VETO nominativo del grupo y rechazará la admisión. ¿Confirmas tu voto?';
    }
    if (!window.confirm(confirmMsg)) return;

    setSubmittingVote(true);
    try {
      const res = await asambleasApi.votar(proposalDetail.id, voto);
      if (res?.proposal_status === 'approved') {
        alert('🎉 ¡Propuesta Aprobada! ¡Consenso unánime alcanzado!');
      } else if (res?.proposal_status === 'rejected') {
        alert('🚫 Propuesta Rechazada por la asamblea.');
      } else {
        alert(`¡Voto Registrado: ${voto.toUpperCase()}!`);
      }
      const updated = await asambleasApi.getPropuesta(proposalDetail.id);
      setProposalDetail(updated);
      fetchPropuestas(true);
    } catch (err) {
      alert(err?.message || 'Error al registrar el voto');
    } finally {
      setSubmittingVote(false);
    }
  };

  // Concluir Propuesta en el Modal de Detalle
  const handleCerrarInDetail = async () => {
    if (!proposalDetail) return;
    if (!window.confirm('¿Deseas cerrar la propuesta y registrar la resolución oficial ahora?')) return;
    setClosingProposal(true);
    try {
      const res = await asambleasApi.cerrarPropuesta(proposalDetail.id);
      alert(res.status === 'approved' ? '🎉 Propuesta Aprobada exitosamente' : '🚫 Propuesta Rechazada');
      const updated = await asambleasApi.getPropuesta(proposalDetail.id);
      setProposalDetail(updated);
      fetchPropuestas(true);
    } catch (err) {
      alert(err?.message || 'No se pudo cerrar la propuesta');
    } finally {
      setClosingProposal(false);
    }
  };

  // Publicar o Actualizar Defensa en Modal
  const handlePublicarDefensaInDetail = async (e) => {
    if (e) e.preventDefault();
    if (!proposalDetail || !defenseInput.trim()) return;
    try {
      await asambleasApi.publicarDefensa(proposalDetail.id, defenseInput.trim());
      alert('Tu alegato de defensa ha sido publicado ante la asamblea familiar.');
      const updated = await asambleasApi.getPropuesta(proposalDetail.id);
      setProposalDetail(updated);
      fetchPropuestas(true);
    } catch (err) {
      alert(err?.message || 'Error al publicar defensa');
    }
  };

  // Cancelar Invitación de Ingreso en Modal
  const handleCancelarIngresoInDetail = async () => {
    if (!proposalDetail) return;
    if (!window.confirm('¿Deseas cancelar esta invitación de ingreso? El código se invalidará y la propuesta pasará al historial.')) return;
    try {
      await asambleasApi.cancelarIngreso(proposalDetail.id);
      alert('Ingreso cancelado exitosamente');
      const updated = await asambleasApi.getPropuesta(proposalDetail.id);
      setProposalDetail(updated);
      fetchPropuestas(true);
    } catch (err) {
      alert(err?.message || 'Error al cancelar ingreso');
    }
  };

  // Renderizar contenido de comentario destacando menciones @
  const renderCommentContent = (content) => {
    if (!content) return null;
    const authorNames = Array.from(new Set(comments.map((c) => c.author_name).filter(Boolean)));
    const patterns = authorNames
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const patternStr = patterns.length > 0
      ? `(@(?:${patterns.join('|')}|[A-Za-z0-9_]+))`
      : '(@[A-Za-z0-9_]+)';
    const regex = new RegExp(patternStr, 'g');
    const parts = content.split(regex);
    if (!parts || parts.length <= 1) {
      return <p style={{ color: '#e2e8f0', fontSize: '0.88rem', margin: '4px 0 0 0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>{content}</p>;
    }
    return (
      <p style={{ color: '#e2e8f0', fontSize: '0.88rem', margin: '4px 0 0 0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
        {parts.map((part, idx) => {
          if (part && part.startsWith('@')) {
            return (
              <span key={idx} style={{ color: '#38bdf8', fontWeight: '700' }}>
                {part}
              </span>
            );
          }
          return part;
        })}
      </p>
    );
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

  // Compartir invitación por WhatsApp
  const handleShareInvite = (token, name, codeFormatted) => {
    const code = codeFormatted || token;
    const targetName = name ? ` ${name}` : '';
    const shareMessage = `¡Hola${targetName}! 👋\n\n¡Has sido aprobado para unirte a nuestra Mutual Familiar en la app MutualFam 🤝!\n\n1️⃣ Abre este enlace en la web:\n${window.location.origin}/join/${token}\n\n2️⃣ O ingresa con este código de invitación:\n*${code}*\n\n⏱️ Este código de invitación es válido por 15 días. ¡Bienvenido a la mutual!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Abrir modal de Proponer Ingreso con validación de límite
  const handleOpenIngresoModal = () => {
    if (throttleStatus && !throttleStatus.can_propose) {
      alert(throttleStatus.reason || 'Has alcanzado el límite de propuestas permitidas en este momento.');
      return;
    }
    setCreatedInvite(null);
    setShowIngresoModal(true);
  };

  // Abrir modal de Proponer Expulsión con validación de límite
  const handleOpenExpulsionModal = () => {
    if (throttleStatus && !throttleStatus.can_propose) {
      alert(throttleStatus.reason || 'Has alcanzado el límite de propuestas permitidas en este momento.');
      return;
    }
    fetchExpulsables();
    setShowExpulsionModal(true);
  };

  // Proponer Ingreso
  const handleProponerIngreso = async (e) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateMotive.trim()) {
      alert('Por favor completa el nombre del familiar y la justificación');
      return;
    }
    setSubmittingIngreso(true);
    try {
      const res = await asambleasApi.proponerIngreso({
        candidate_name: candidateName.trim(),
        candidate_relation: candidateRelation.trim() || undefined,
        candidate_phone: candidatePhone.trim() || undefined,
        justificacion: candidateMotive.trim()
      });
      setShowIngresoModal(false);
      setCandidateName('');
      setCandidateRelation('');
      setCandidatePhone('');
      setCandidateMotive('');
      await fetchPropuestas();
      alert('¡Propuesta de admisión creada! Se ha abierto el período en la asamblea familiar.');
    } catch (err) {
      asambleasApi.getThrottleStatus().then(st => setThrottleStatus(st)).catch(() => {});
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
        target_user_id: parseInt(targetMemberId, 10),
        target_member_id: parseInt(targetMemberId, 10),
        motivo: expulsionMotive.trim(),
        motive: expulsionMotive.trim()
      });
      setShowExpulsionModal(false);
      setTargetMemberId('');
      setExpulsionMotive('');
      await fetchPropuestas();
      alert('¡Propuesta de expulsión registrada para debate en la asamblea familiar!');
    } catch (err) {
      asambleasApi.getThrottleStatus().then(st => setThrottleStatus(st)).catch(() => {});
      alert(err.message || 'Error al proponer expulsión');
    } finally {
      setSubmittingExpulsion(false);
    }
  };

  // Filtrar propuestas homologado con Android
  const isProposalActive = (p) => {
    if (p.is_active_proposal !== undefined) {
      return Boolean(p.is_active_proposal);
    }
    const isAdmission = p.proposal_type === 'member_admission' || p.category === 'ADMISSION' || p.proposal_type === 'ADMISSION';
    const isApproved = p.status === 'APPROVED' || p.status === 'approved';
    if (isAdmission && isApproved) {
      const hasJoined = Boolean(p.member_joined || p.redeemed_by_name);
      const isCancelled = Boolean(p.admission_cancelled);
      let isExpired = false;
      if (p.invite_expires_at) {
        try {
          isExpired = new Date(p.invite_expires_at) <= new Date();
        } catch (e) {}
      }
      return !hasJoined && !isCancelled && !isExpired;
    }
    const st = String(p.status || '').toLowerCase();
    return st === 'debate' || st === 'voting';
  };

  const activeProposals = propuestas.filter(isProposalActive);
  const historyProposals = propuestas.filter(p => !isProposalActive(p));
  const displayedPropuestas = asambleaFilter === 'activas' ? activeProposals : historyProposals;

  return (
    <div className="page-panel animate-fade-in pb-12" style={{ padding: '1.25rem 1rem' }}>
      {/* Cabecera Principal Homologada con Android */}
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
      </div>

      {/* Control Segmentado de Sub-pestañas: Miembros vs Asamblea (Homologado con Móvil) */}
      <div style={{
        display: 'flex',
        backgroundColor: '#1e293b',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.25rem',
      }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('miembros')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'miembros' ? '#334155' : 'transparent',
            color: activeMainTab === 'miembros' ? '#ffffff' : '#94a3b8',
            fontWeight: activeMainTab === 'miembros' ? '700' : '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          👥 Miembros {hasLoadedMembers && members.length > 0 ? `(${members.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('asamblea')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'asamblea' ? '#334155' : 'transparent',
            color: activeMainTab === 'asamblea' ? '#ffffff' : '#94a3b8',
            fontWeight: activeMainTab === 'asamblea' ? '700' : '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🏛️ Asamblea {hasLoadedAsambleas && activeProposals.length > 0 ? `(${activeProposals.length})` : ''}
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
                  Miembros Actuales {hasLoadedMembers && members.length > 0 ? `(${members.length})` : ''}
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
                                  whiteSpace: 'nowrap'
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
                  Durante las primeras 24 horas (período de gracia), el fundador puede invitar directamente. Concluida esa etapa, los ingresos se procesan mediante <strong>Asamblea Familiar (consenso unánime con veto nominativo)</strong>.
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
                      borderColor: '#0284c7',
                      color: '#38bdf8',
                    }}
                    onClick={() => {
                      setActiveMainTab('asamblea');
                      handleOpenIngresoModal();
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
          {/* Indicador de límite o enfriamiento contra spam */}
          {throttleStatus && !throttleStatus.can_propose && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '14px',
              color: '#fbbf24',
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              <span style={{ fontSize: '18px' }}>⏱️</span>
              <span>{throttleStatus.reason}</span>
            </div>
          )}

          {/* Botones de acción principales Homologados con Android */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleOpenIngresoModal}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '12px',
                gap: '6px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 3px 6px rgba(2, 132, 199, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '16px' }}>📥</span>
              <span>Proponer Ingreso</span>
            </button>

            <button
              type="button"
              onClick={handleOpenExpulsionModal}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '12px',
                borderRadius: '12px',
                gap: '6px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>Proponer Expulsión</span>
            </button>
          </div>

          {/* Sub-tabs Activas vs Historial Homologadas con Android */}
          <div style={{
            display: 'flex',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '16px'
          }}>
            <button
              type="button"
              onClick={() => setAsambleaFilter('activas')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: asambleaFilter === 'activas' ? '#334155' : 'transparent',
                color: asambleaFilter === 'activas' ? '#ffffff' : '#94a3b8',
                fontWeight: asambleaFilter === 'activas' ? '700' : '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Activas {hasLoadedAsambleas ? `(${activeProposals.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setAsambleaFilter('historial')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: asambleaFilter === 'historial' ? '#334155' : 'transparent',
                color: asambleaFilter === 'historial' ? '#ffffff' : '#94a3b8',
                fontWeight: asambleaFilter === 'historial' ? '700' : '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Historial {hasLoadedAsambleas ? `(${historyProposals.length})` : ''}
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
                padding: '3rem 1.5rem',
                backgroundColor: '#1e293b',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🏛️</div>
                <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                  {asambleaFilter === 'activas' ? 'No hay propuestas en debate o votación' : 'No hay propuestas en el historial'}
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {asambleaFilter === 'activas'
                    ? 'Cualquier miembro activo puede proponer nuevos ingresos o temas a la asamblea.'
                    : 'Las decisiones aprobadas o rechazadas aparecerán aquí.'}
                </p>
                {asambleaFilter === 'activas' && (
                  <button
                    type="button"
                    onClick={handleOpenIngresoModal}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Proponer Ingreso
                  </button>
                )}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {displayedPropuestas.map((item) => {
                const isAdmission = item.proposal_type === 'member_admission' || item.category === 'ADMISSION' || item.proposal_type === 'ADMISSION';
                const st = String(item.status || '').toLowerCase();
                const isDebate = st === 'debate';
                const isVoting = st === 'voting';
                const isApproved = st === 'approved';
                const isRejected = st === 'rejected';

                const isAuthor = Boolean(item.is_author ?? (user?.id && (item.author_id === user.id || item.author_user_id === user.id)));
                const hasJoined = Boolean(item.member_joined || item.redeemed_by_name);
                const isAdmissionCancelled = Boolean(item.admission_cancelled);
                const isWaitingEntry = isAdmission && isApproved && !hasJoined && !isAdmissionCancelled;

                let statusColor = '#f59e0b';
                let statusLabel = '⏳ Debate';
                if (isVoting) {
                  statusColor = '#3b82f6';
                  statusLabel = '🗳️ Votación';
                } else if (isApproved) {
                  if (isWaitingEntry) {
                    statusColor = '#0284c7';
                    statusLabel = '⏳ Esperando Ingreso';
                  } else if (isAdmission && isAdmissionCancelled) {
                    statusColor = '#64748b';
                    statusLabel = '⏱️ Ingreso Cancelado';
                  } else {
                    statusColor = '#10b981';
                    statusLabel = isAdmission ? '✅ Ingreso Completado' : '✅ Aprobada';
                  }
                } else if (isRejected) {
                  statusColor = '#ef4444';
                  statusLabel = item.veto_activated ? '🚫 Vetada' : '❌ Rechazada';
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => openProposalDetail(item)}
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    {/* Header Row: Type Badge + Outlined Status Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{
                        backgroundColor: isAdmission ? '#0369a1' : '#be123c',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}>
                        {isAdmission ? '📥 Admisión de Miembro' : '⚠️ Expulsión de Miembro'}
                      </div>
                      <div style={{
                        border: `1px solid ${statusColor}`,
                        color: statusColor,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        backgroundColor: 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}>
                        {statusLabel}
                      </div>
                    </div>

                    {/* Card Title */}
                    <h3 style={{ color: '#f8fafc', fontSize: '16px', fontWeight: '700', margin: '0 0 8px 0' }}>
                      {item.title || (isAdmission ? `Admisión de ${item.candidate_name || 'Familiar'}` : `Expulsión de ${item.target_member_name || 'Miembro'}`)}
                    </h3>

                    {/* Meta Row: Autor y Temporizador */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                        👤 Propuesto por: <strong style={{ color: '#e2e8f0' }}>{item.author_name || 'Miembro'}</strong>
                      </span>
                      {isVoting && (
                        <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: '600' }}>
                          ⏱️ {item.time_remaining_seconds > 0 ? formatRemainingTime(item.time_remaining_seconds) : 'Votación concluida'}
                        </span>
                      )}
                      {isDebate && item.time_remaining_seconds > 0 && (
                        <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: '600' }}>
                          💬 Debate ({formatRemainingTime(item.time_remaining_seconds)})
                        </span>
                      )}
                    </div>

                    {/* Snippet de Admisión de Miembro */}
                    {isAdmission && (
                      <div style={{
                        backgroundColor: '#0f172a',
                        borderRadius: '10px',
                        padding: '10px',
                        marginBottom: '10px',
                        fontSize: '13px',
                      }}>
                        {item.candidate_relation ? (
                          <div style={{ color: '#cbd5e1', marginBottom: '6px' }}>
                            🤝 Parentesco: <strong style={{ color: '#f8fafc' }}>{item.candidate_relation}</strong>
                          </div>
                        ) : null}

                        {hasJoined ? (
                          <div style={{ color: '#94a3b8' }}>
                            👤 Miembro incorporado: <strong style={{ color: '#38bdf8' }}>{item.redeemed_by_name || item.candidate_name}</strong>
                          </div>
                        ) : isAdmissionCancelled ? (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                            ⏱️ Invitación expirada • Ingreso cancelado por falta de canje en 15 días
                          </div>
                        ) : isWaitingEntry ? (
                          isAuthor && item.invite_token ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <div style={{
                                  backgroundColor: '#1e293b',
                                  border: '1px solid #38bdf8',
                                  color: '#38bdf8',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontFamily: 'monospace',
                                  fontWeight: '700',
                                  fontSize: '14px',
                                }}>
                                  🔑 {item.invite_code_formatted || item.invite_token}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareInvite(item.invite_token, item.candidate_name, item.invite_code_formatted);
                                  }}
                                  style={{
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '5px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                  }}
                                >
                                  💬 Compartir
                                </button>
                              </div>
                              <div style={{ color: '#fbbf24', fontStyle: 'italic', fontSize: '12px' }}>
                                ⏳ Invitación de 15 días aprobada y lista para canje.
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#38bdf8', fontSize: '12px' }}>
                              ⏳ Aprobada por la asamblea. Código entregado al proponente ({item.author_name}). En espera del ingreso del nuevo miembro.
                            </div>
                          )
                        ) : (isDebate || isVoting) ? (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                            ⚖️ En proceso de asamblea (El enlace se generará una vez aprobado)
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Resumen de Votos */}
                    {!isDebate ? (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#0f172a',
                        borderRadius: '10px',
                        padding: '10px',
                        marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#cbd5e1' }}>
                          <span>👍 <strong style={{ color: '#10b981' }}>{item.votes_yes || 0}</strong> SÍ</span>
                          <span>👎 <strong style={{ color: '#ef4444' }}>{item.votes_no || 0}</strong> NO</span>
                          <span>⬜ <strong style={{ color: '#94a3b8' }}>{item.votes_abstain || 0}</strong> Abst.</span>
                        </div>
                        {item.my_vote && (
                          <div style={{
                            backgroundColor: '#334155',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#e2e8f0',
                          }}>
                            Tu voto: <strong style={{
                              color: item.my_vote === 'si' ? '#10b981' : item.my_vote === 'no' ? '#ef4444' : '#94a3b8'
                            }}>{item.my_vote.toUpperCase()}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        backgroundColor: '#0f172a',
                        borderRadius: '10px',
                        padding: '10px',
                        marginBottom: '10px',
                        color: '#94a3b8',
                        fontSize: '12px',
                        fontStyle: 'italic',
                      }}>
                        💬 En debate • Votación aún no iniciada
                      </div>
                    )}

                    {/* Banner de Veto si aplica */}
                    {item.veto_activated && item.vetantes_names?.length > 0 && (
                      <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        marginBottom: '10px',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}>
                        🚫 Vetada nominativamente por: {item.vetantes_names.join(', ')}
                      </div>
                    )}

                    {/* Botón de Acción Principal Homologado con Android */}
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProposalDetail(item);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          borderWidth: '1.5px',
                          borderStyle: 'solid',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          ...(isVoting
                            ? (!item.my_vote
                              ? { backgroundColor: '#0284c7', borderColor: '#38bdf8', color: '#ffffff', boxShadow: '0 3px 6px rgba(2, 132, 199, 0.35)' }
                              : { backgroundColor: '#0369a1', borderColor: '#38bdf8', color: '#ffffff' })
                            : isDebate
                            ? { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderColor: '#f59e0b', color: '#fbbf24' }
                            : isWaitingEntry
                            ? (isAuthor
                              ? { backgroundColor: '#0284c7', borderColor: '#38bdf8', color: '#ffffff', boxShadow: '0 3px 6px rgba(2, 132, 199, 0.35)' }
                              : { backgroundColor: 'rgba(2, 132, 199, 0.25)', borderColor: '#0284c7', color: '#38bdf8' })
                            : { backgroundColor: 'rgba(51, 65, 85, 0.5)', borderColor: 'rgba(148, 163, 184, 0.25)', color: '#cbd5e1' })
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>
                          {isVoting ? '🗳️' : isDebate ? '💬' : isWaitingEntry ? (isAuthor ? '🔑' : '⏳') : '📜'}
                        </span>
                        <span>
                          {isVoting
                            ? (!item.my_vote
                              ? 'Ver y Votar (Voto Pendiente) →'
                              : 'Ver y Votar →')
                            : isDebate
                            ? 'Ver y Participar en Debate →'
                            : isWaitingEntry
                            ? (isAuthor ? 'Ver Invitación y Compartir →' : 'Ver Detalle de Asamblea →')
                            : 'Ver Detalle de Asamblea →'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DETALLE Y DEBATE (HOMOLOGADO CON ANDROID)          */}
      {/* ======================================================== */}
      {showDetailModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
          overflowY: 'auto'
        }} onClick={() => setShowDetailModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '1.5rem',
            maxWidth: '38rem',
            width: '100%',
            color: '#f8fafc',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          }} onClick={(e) => e.stopPropagation()}>
            {loadingDetail || !proposalDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="loader mx-auto mb-3" />
                <p style={{ color: '#94a3b8' }}>Cargando detalle de asamblea...</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
                {/* Header Modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{
                    backgroundColor: proposalDetail.proposal_type === 'member_admission' ? '#0369a1' : '#be123c',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}>
                    {proposalDetail.proposal_type === 'member_admission' ? '📥 Ingreso' : '⚠️ Expulsión'}
                  </div>
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
                    onClick={() => setShowDetailModal(false)}
                  >
                    ✕
                  </button>
                </div>

                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 12px 0', color: '#f8fafc' }}>
                  {proposalDetail.title}
                </h2>

                {/* Fase y Tiempo */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '14px',
                }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                    {proposalDetail.phase_label}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                    {proposalDetail.status === 'voting' ? (
                      proposalDetail.time_remaining_seconds > 0
                        ? `⏱️ Tiempo restante: ${formatRemainingTime(proposalDetail.time_remaining_seconds)}`
                        : '⏱️ Plazo concluido • Votación lista para computar resolución'
                    ) : proposalDetail.status === 'debate' ? (
                      proposalDetail.time_remaining_seconds > 0
                        ? `💬 Tiempo de debate: ${formatRemainingTime(proposalDetail.time_remaining_seconds)}`
                        : '💬 Deliberación concluida • Pasando a votación'
                    ) : proposalDetail.status === 'approved' ? (
                      <span style={{ color: '#34d399' }}>✅ Propuesta aprobada por la asamblea familiar</span>
                    ) : proposalDetail.status === 'rejected' ? (
                      <span style={{ color: '#f87171' }}>
                        {proposalDetail.veto_activated
                          ? '🚫 Propuesta rechazada por veto nominativo'
                          : '❌ Propuesta no aprobada por la asamblea'}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Sección Motivo / Justificación */}
                <div style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '14px',
                }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Motivo / Justificación:
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                    {proposalDetail.content || proposalDetail.motive}
                  </p>
                  {proposalDetail.candidate_relation ? (
                    <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                      🤝 Parentesco / Vínculo: <strong style={{ color: '#f8fafc' }}>{proposalDetail.candidate_relation}</strong>
                    </div>
                  ) : null}
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    👤 Propuesto por: <strong style={{ color: '#e2e8f0' }}>{proposalDetail.author_name}</strong>
                  </div>
                </div>

                {/* 1. SECCIÓN DE VOTACIÓN DIRECTA (Si está en Votación Abierta) */}
                {proposalDetail.status === 'voting' && (() => {
                  const isExpulsion = proposalDetail.proposal_type === 'expulsion' || proposalDetail.proposal_type === 'member_expulsion' || proposalDetail.category === 'EXPULSION';
                  const targetName = proposalDetail.target_member_name || (proposalDetail.title && proposalDetail.title.startsWith('Expulsión de ') ? proposalDetail.title.replace('Expulsión de ', '').trim() : null);
                  const expulsionQuestion = targetName ? `¿Deseas expulsar a ${targetName} de la mutual?` : '¿Deseas expulsar al miembro de la mutual?';

                  return (
                    <div style={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '14px',
                      border: '1.5px solid #1e293b'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div style={{ fontSize: '13px', color: isExpulsion ? '#fca5a5' : '#f8fafc', fontWeight: '700' }}>
                          {isExpulsion ? expulsionQuestion : 'Emite tu voto (nominativo):'}
                        </div>
                        {proposalDetail.my_vote && (
                          <div style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            flexShrink: 0,
                            backgroundColor: isExpulsion
                              ? (proposalDetail.my_vote === 'si'
                                  ? 'rgba(239, 68, 68, 0.25)'
                                  : proposalDetail.my_vote === 'no'
                                    ? 'rgba(16, 185, 129, 0.25)'
                                    : 'rgba(56, 189, 248, 0.25)')
                              : (proposalDetail.my_vote === 'si'
                                  ? 'rgba(16, 185, 129, 0.25)'
                                  : proposalDetail.my_vote === 'no'
                                    ? 'rgba(239, 68, 68, 0.25)'
                                    : 'rgba(56, 189, 248, 0.25)'),
                            color: isExpulsion
                              ? (proposalDetail.my_vote === 'si'
                                  ? '#f87171'
                                  : proposalDetail.my_vote === 'no'
                                    ? '#34d399'
                                    : '#38bdf8')
                              : (proposalDetail.my_vote === 'si'
                                  ? '#34d399'
                                  : proposalDetail.my_vote === 'no'
                                    ? '#f87171'
                                    : '#38bdf8'),
                            border: `1px solid ${isExpulsion
                              ? (proposalDetail.my_vote === 'si' ? '#ef4444' : proposalDetail.my_vote === 'no' ? '#10b981' : '#38bdf8')
                              : (proposalDetail.my_vote === 'si' ? '#10b981' : proposalDetail.my_vote === 'no' ? '#ef4444' : '#38bdf8')}`
                          }}>
                            Tu voto: {isExpulsion
                              ? (proposalDetail.my_vote === 'si' ? '⚠️ Sí, expulsar' : proposalDetail.my_vote === 'no' ? '🛡️ No, mantener' : '⬜ Abstención')
                              : (proposalDetail.my_vote === 'si' ? '👍 SÍ' : proposalDetail.my_vote === 'no' ? '👎 NO' : '⬜ Abstención')}
                          </div>
                        )}
                      </div>

                      {/* Botones de Voto */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px', alignItems: 'stretch' }}>
                        <button
                          type="button"
                          onClick={() => handleVotarInDetail('si')}
                          disabled={submittingVote}
                          style={{
                            backgroundColor: proposalDetail.my_vote === 'si'
                              ? (isExpulsion ? '#b91c1c' : '#059669')
                              : proposalDetail.my_vote
                                ? '#0b1329'
                                : (isExpulsion ? '#7f1d1d' : '#064e3b'),
                            border: proposalDetail.my_vote === 'si'
                              ? (isExpulsion ? '2.5px solid #f87171' : '2.5px solid #34d399')
                              : proposalDetail.my_vote
                                ? '1px solid rgba(255,255,255,0.1)'
                                : (isExpulsion ? '1.5px solid #dc2626' : '1.5px solid #059669'),
                            color: '#ffffff',
                            opacity: proposalDetail.my_vote && proposalDetail.my_vote !== 'si' ? 0.35 : 1,
                            borderRadius: '12px',
                            padding: '8px 4px',
                            fontSize: '13px',
                            fontWeight: proposalDetail.my_vote === 'si' ? '800' : '700',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '58px',
                            boxShadow: proposalDetail.my_vote === 'si'
                              ? (isExpulsion ? '0 0 10px rgba(248, 113, 113, 0.5)' : '0 0 10px rgba(52, 211, 153, 0.5)')
                              : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>{isExpulsion ? '⚠️ Sí, expulsar' : '👍 SÍ'}</span>
                          {proposalDetail.my_vote === 'si' && (
                            <span style={{
                              marginTop: '4px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.25)',
                              border: '1px solid #ffffff',
                              fontSize: '10px',
                              fontWeight: '800',
                              letterSpacing: '0.3px',
                              color: '#ffffff'
                            }}>
                              ✓ Tu voto
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVotarInDetail('no')}
                          disabled={submittingVote}
                          style={{
                            backgroundColor: proposalDetail.my_vote === 'no'
                              ? (isExpulsion ? '#059669' : '#b91c1c')
                              : proposalDetail.my_vote
                                ? '#0b1329'
                                : (isExpulsion ? '#064e3b' : '#7f1d1d'),
                            border: proposalDetail.my_vote === 'no'
                              ? (isExpulsion ? '2.5px solid #34d399' : '2.5px solid #f87171')
                              : proposalDetail.my_vote
                                ? '1px solid rgba(255,255,255,0.1)'
                                : (isExpulsion ? '1.5px solid #059669' : '1.5px solid #dc2626'),
                            color: '#ffffff',
                            opacity: proposalDetail.my_vote && proposalDetail.my_vote !== 'no' ? 0.35 : 1,
                            borderRadius: '12px',
                            padding: '8px 4px',
                            fontSize: '13px',
                            fontWeight: proposalDetail.my_vote === 'no' ? '800' : '700',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '58px',
                            boxShadow: proposalDetail.my_vote === 'no'
                              ? (isExpulsion ? '0 0 10px rgba(52, 211, 153, 0.5)' : '0 0 10px rgba(248, 113, 113, 0.5)')
                              : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>{isExpulsion ? '🛡️ No, mantener' : `👎 NO ${proposalDetail.proposal_type === 'member_admission' ? '(Veto)' : ''}`}</span>
                          {proposalDetail.my_vote === 'no' && (
                            <span style={{
                              marginTop: '4px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.25)',
                              border: '1px solid #ffffff',
                              fontSize: '10px',
                              fontWeight: '800',
                              letterSpacing: '0.3px',
                              color: '#ffffff'
                            }}>
                              ✓ Tu voto
                            </span>
                          )}
                        </button>

                      <button
                        type="button"
                        onClick={() => handleVotarInDetail('abstencion')}
                        disabled={submittingVote}
                        style={{
                          backgroundColor: proposalDetail.my_vote === 'abstencion' ? '#334155' : proposalDetail.my_vote ? '#0b1329' : '#1e293b',
                          border: proposalDetail.my_vote === 'abstencion' ? '2.5px solid #38bdf8' : proposalDetail.my_vote ? '1px solid rgba(255,255,255,0.1)' : '1.5px solid #64748b',
                          color: '#ffffff',
                          opacity: proposalDetail.my_vote && proposalDetail.my_vote !== 'abstencion' ? 0.35 : 1,
                          borderRadius: '12px',
                          padding: '8px 4px',
                          fontSize: '13px',
                          fontWeight: proposalDetail.my_vote === 'abstencion' ? '800' : '700',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '58px',
                          boxShadow: proposalDetail.my_vote === 'abstencion' ? '0 0 10px rgba(56, 189, 248, 0.5)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>⬜ Abstención</span>
                        {proposalDetail.my_vote === 'abstencion' && (
                          <span style={{
                            marginTop: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(56, 189, 248, 0.25)',
                            border: '1px solid #38bdf8',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.3px',
                            color: '#38bdf8'
                          }}>
                            ✓ Tu voto
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Conteo de Votos e Indicadores */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div style={{
                        border: isExpulsion
                          ? (proposalDetail.my_vote === 'si' ? '2px solid #ef4444' : '1.5px solid #ef4444')
                          : (proposalDetail.my_vote === 'si' ? '2px solid #10b981' : '1.5px solid #10b981'),
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: isExpulsion
                          ? (proposalDetail.my_vote === 'si' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                          : (proposalDetail.my_vote === 'si' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)')
                      }}>
                        <div style={{ color: isExpulsion ? '#ef4444' : '#10b981', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_yes || 0}</div>
                        <div style={{ color: proposalDetail.my_vote === 'si' ? (isExpulsion ? '#f87171' : '#34d399') : '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                          {isExpulsion ? 'POR EXPULSAR (SÍ)' : 'A FAVOR (SÍ)'}{proposalDetail.my_vote === 'si' ? ' • Tú' : ''}
                        </div>
                      </div>
                      <div style={{
                        border: isExpulsion
                          ? (proposalDetail.my_vote === 'no' ? '2px solid #10b981' : '1.5px solid #10b981')
                          : (proposalDetail.my_vote === 'no' ? '2px solid #ef4444' : '1.5px solid #ef4444'),
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: isExpulsion
                          ? (proposalDetail.my_vote === 'no' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)')
                          : (proposalDetail.my_vote === 'no' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                      }}>
                        <div style={{ color: isExpulsion ? '#10b981' : '#ef4444', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_no || 0}</div>
                        <div style={{ color: proposalDetail.my_vote === 'no' ? (isExpulsion ? '#34d399' : '#f87171') : '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                          {isExpulsion ? 'POR MANTENER (NO)' : 'EN CONTRA (NO)'}{proposalDetail.my_vote === 'no' ? ' • Tú' : ''}
                        </div>
                      </div>
                      <div style={{
                        border: proposalDetail.my_vote === 'abstencion' ? '2px solid #38bdf8' : '1.5px solid #94a3b8',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: proposalDetail.my_vote === 'abstencion' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.1)'
                      }}>
                        <div style={{ color: proposalDetail.my_vote === 'abstencion' ? '#38bdf8' : '#94a3b8', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_abstain || 0}</div>
                        <div style={{ color: proposalDetail.my_vote === 'abstencion' ? '#38bdf8' : '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                          ABSTENCIÓN{proposalDetail.my_vote === 'abstencion' ? ' • Tú' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Avance del Censo y Participación */}
                    <div style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#cbd5e1',
                      marginBottom: '10px',
                    }}>
                      👥 Participación: <strong style={{ color: '#f8fafc' }}>
                        {(proposalDetail.total_votes_casted !== undefined ? proposalDetail.total_votes_casted : ((proposalDetail.votes_yes || 0) + (proposalDetail.votes_no || 0) + (proposalDetail.votes_abstain || 0)))} de {proposalDetail.total_active_members || 2} miembros
                      </strong>
                      {proposalDetail.pending_votes !== undefined && proposalDetail.pending_votes > 0
                        ? ` (Faltan ${proposalDetail.pending_votes} por votar)`
                        : (proposalDetail.total_votes_casted !== undefined && proposalDetail.total_votes_casted >= (proposalDetail.total_active_members || 2))
                          ? ' (100% del censo ha votado)'
                          : ''}
                    </div>

                    {/* Concluir Votación */}
                    {proposalDetail.can_conclude && (
                      <button
                        type="button"
                        onClick={handleCerrarInDetail}
                        disabled={closingProposal}
                        style={{
                          width: '100%',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '10px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginBottom: '10px'
                        }}
                      >
                        {closingProposal ? 'Computando resolución...' : '⚖️ Computar y Concluir Votación'}
                      </button>
                    )}

                    {/* Desplegable de Reglas y Explicaciones */}
                    <button
                      type="button"
                      onClick={() => setShowVotingRules(!showVotingRules)}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#94a3b8',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>ℹ️ {showVotingRules ? 'Ocultar regla y detalles' : 'Ver regla de votación y detalles'}</span>
                      <span>{showVotingRules ? '▲' : '▼'}</span>
                    </button>

                    {showVotingRules && (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                          {proposalDetail.proposal_type === 'member_admission'
                            ? `* Regla de Admisión: Requiere ≥75% de aprobación (${proposalDetail.votes_yes_needed || 2} de ${proposalDetail.total_active_members || 2} votos SÍ) y cero votos NO (Consenso con Veto).`
                            : '* Regla de Expulsión: Requiere supermayoría de 75% de los votos emitidos.'}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: proposalDetail.threshold_reached ? '#4ade80' : '#94a3b8',
                          lineHeight: '1.4'
                        }}>
                          {(() => {
                            if (proposalDetail.has_veto) {
                              return '🚫 Se ha registrado un voto en contra (Veto). Esta propuesta de admisión será rechazada.';
                            }
                            if (proposalDetail.proposal_type === 'member_admission') {
                              const needed = proposalDetail.votes_yes_needed || 2;
                              const currentYes = proposalDetail.votes_yes || 0;
                              const total = proposalDetail.total_active_members || 2;
                              const pending = proposalDetail.pending_votes !== undefined ? proposalDetail.pending_votes : (total - (currentYes + (proposalDetail.votes_no || 0) + (proposalDetail.votes_abstain || 0)));

                              if (proposalDetail.threshold_reached && pending === 0) {
                                return '✓ Todos los miembros han votado y se alcanzó el umbral (≥75% SÍ sin vetos). Puedes registrar la resolución oficial ahora.';
                              }
                              if (currentYes >= total) {
                                return '🎉 ¡Unanimidad afirmativa alcanzada (100% SÍ)! Puedes registrar la resolución oficial ahora.';
                              }
                              return `⏳ Votación en curso (${currentYes} de ${needed} votos SÍ requeridos). Faltan ${pending} miembro(s) por votar; si algún miembro vota NO se activará el veto.`;
                            }
                            if (proposalDetail.threshold_reached && (proposalDetail.pending_votes === 0 || proposalDetail.time_remaining_seconds <= 0)) {
                              return '✓ El umbral de aprobación ha sido alcanzado. Puedes registrar la resolución oficial ahora.';
                            }
                            return '⏳ Votación en curso. Se espera la participación de todos los miembros o el vencimiento del plazo para registrar el resultado oficial.';
                          })()}
                        </div>
                        {proposalDetail.proposal_type === 'member_admission' && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            El enlace y código de invitación se generarán automáticamente en cuanto la asamblea apruebe el ingreso.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* 2. Enlace de Invitación Oficial (Admisión - Solo cuando está Aprobada) */}
                {proposalDetail.proposal_type === 'member_admission' && proposalDetail.status === 'approved' && (
                  (proposalDetail.member_joined || proposalDetail.redeemed_by_name) ? (
                    <div style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10b981',
                      borderRadius: '12px',
                      padding: '12px',
                      marginBottom: '14px',
                      color: '#a7f3d0',
                      fontSize: '13px'
                    }}>
                      ✅ <strong>Ingreso Concretado:</strong> El familiar {proposalDetail.redeemed_by_name || proposalDetail.candidate_name} ya canjeó su invitación y es miembro activo de la mutual.
                    </div>
                  ) : proposalDetail.admission_cancelled ? (
                    <div style={{
                      backgroundColor: 'rgba(100, 116, 139, 0.2)',
                      border: '1px solid #64748b',
                      borderRadius: '12px',
                      padding: '12px',
                      marginBottom: '14px',
                      color: '#cbd5e1',
                      fontSize: '13px'
                    }}>
                      ⏱️ <strong>Ingreso Cancelado:</strong> La invitación de 15 días expiró sin que el nuevo miembro ingresara a la mutual.
                    </div>
                  ) : (proposalDetail.is_author || (user?.id && proposalDetail.author_id === user.id) || proposalDetail.invite_token) ? (
                    <div style={{
                      backgroundColor: 'rgba(2, 132, 199, 0.15)',
                      border: '1px solid #0284c7',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '14px',
                    }}>
                      <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Enlace de Invitación Oficial:
                      </div>
                      <div style={{
                        fontSize: '22px',
                        fontWeight: '800',
                        letterSpacing: '0.1em',
                        fontFamily: 'monospace',
                        color: '#38bdf8',
                        margin: '8px 0',
                        textAlign: 'center',
                        backgroundColor: '#0f172a',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {proposalDetail.invite_code_formatted || proposalDetail.invite_token}
                      </div>
                      <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '0 0 12px 0', textAlign: 'center' }}>
                        ⏳ Invitación aprobada de 15 días. Lista para compartir exclusivamente con el familiar.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleShareInvite(proposalDetail.invite_token, proposalDetail.candidate_name, proposalDetail.invite_code_formatted)}
                          style={{
                            flex: 1,
                            backgroundColor: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(proposalDetail.invite_code_formatted || proposalDetail.invite_token);
                            alert('Código copiado al portapapeles');
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: '#334155',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          📋 Copiar
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelarIngresoInDetail}
                        style={{
                          width: '100%',
                          marginTop: '10px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.5)',
                          color: '#f87171',
                          borderRadius: '8px',
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ⚠️ Cancelar Invitación de Ingreso
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '12px',
                      padding: '12px',
                      marginBottom: '14px',
                      color: '#bae6fd',
                      fontSize: '13px'
                    }}>
                      ⏳ <strong>Ingreso Aprobado • En Espera:</strong> La asamblea familiar aprobó el ingreso de {proposalDetail.candidate_name}. El código de invitación oficial fue asignado exclusivamente a {proposalDetail.author_name} (proponente) para su entrega al nuevo miembro.
                    </div>
                  )
                )}

                {/* 3. Conteo de Votos y Resultados Históricos (Solo para estados ya concluidos / rechazados / aprobados) */}
                {proposalDetail.status !== 'debate' && proposalDetail.status !== 'voting' && (
                  <div style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                  }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
                      Resultado Final de Votación
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div style={{
                        border: '1.5px solid #10b981',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)'
                      }}>
                        <div style={{ color: '#10b981', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_yes || 0}</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>A FAVOR (SÍ)</div>
                      </div>
                      <div style={{
                        border: '1.5px solid #ef4444',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                      }}>
                        <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_no || 0}</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>EN CONTRA (NO)</div>
                      </div>
                      <div style={{
                        border: '1.5px solid #94a3b8',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(148, 163, 184, 0.1)'
                      }}>
                        <div style={{ color: '#94a3b8', fontSize: '20px', fontWeight: '800' }}>{proposalDetail.votes_abstain || 0}</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>ABSTENCIÓN</div>
                      </div>
                    </div>

                    {/* Avance del Censo y Participación */}
                    <div style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#cbd5e1',
                    }}>
                      👥 Participación Final: <strong style={{ color: '#f8fafc' }}>
                        {(proposalDetail.total_votes_casted !== undefined ? proposalDetail.total_votes_casted : ((proposalDetail.votes_yes || 0) + (proposalDetail.votes_no || 0) + (proposalDetail.votes_abstain || 0)))} de {proposalDetail.total_active_members || 2} miembros
                      </strong>
                    </div>
                  </div>
                )}

                {/* 4. Sección de Defensa (Expulsión) */}
                {proposalDetail.proposal_type === 'expulsion' && (
                  <div style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '14px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Defensa del Miembro Acusado:
                    </div>
                    {proposalDetail.defense_text ? (
                      <div style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        borderLeft: '4px solid #3b82f6',
                        padding: '10px',
                        borderRadius: '6px',
                        fontStyle: 'italic',
                        color: '#93c5fd',
                        fontSize: '13px',
                      }}>
                        "{proposalDetail.defense_text}"
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                        El miembro aún no ha publicado su texto de defensa.
                      </div>
                    )}

                    {/* Formulario si el usuario actual es el acusado */}
                    {user?.id === proposalDetail.target_member_id && proposalDetail.status === 'debate' && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                          Tu texto de defensa:
                        </label>
                        <textarea
                          rows={3}
                          className="form-input"
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                          placeholder="Escribe tus argumentos o explicaciones para la asamblea..."
                          value={defenseInput}
                          onChange={(e) => setDefenseInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handlePublicarDefensaInDetail}
                          style={{
                            marginTop: '8px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {proposalDetail.defense_text ? 'Actualizar Mi Defensa' : 'Publicar Mi Defensa'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* FORO DE DEBATE Y DELIBERACIÓN */}
                <div style={{
                  backgroundColor: '#0f172a',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '700' }}>
                      💬 Foro de Debate {comments.length > 0 ? `(${comments.length})` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => openProposalDetail(proposalDetail)}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#38bdf8',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Actualizar
                    </button>
                  </div>

                  {proposalDetail.status === 'debate' && (
                    <div style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      fontSize: '12px',
                      color: '#fbbf24',
                    }}>
                      💬 <strong>Período de Deliberación Activo:</strong> Expresa tus argumentos, dudas o preguntas antes de la votación formal.
                    </div>
                  )}

                  {comments.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Aún no hay comentarios en este debate. ¡Sé el primero en compartir tu opinión con la familia!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {comments.map((c) => {
                        let stanceColor = '#38bdf8';
                        let stanceBg = '#075985';
                        let stanceText = '💬 Opinión';
                        if (c.stance === 'favor') {
                          stanceColor = '#34d399';
                          stanceBg = '#065f46';
                          stanceText = '👍 A favor';
                        } else if (c.stance === 'contra') {
                          stanceColor = '#f87171';
                          stanceBg = '#881337';
                          stanceText = '👎 En contra';
                        } else if (c.stance === 'duda') {
                          stanceColor = '#facc15';
                          stanceBg = '#854d0e';
                          stanceText = '🤔 Con dudas';
                        }

                        return (
                          <div
                            key={c.id}
                            style={{
                              backgroundColor: c.is_mine ? 'rgba(59, 130, 246, 0.1)' : '#1e293b',
                              border: c.is_mine ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>
                                <span>👤 {c.author_name}</span>
                                {c.is_mine && <span style={{ color: '#38bdf8', fontSize: '11px' }}>(Tú)</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleReplyToAuthor(c.author_name)}
                                  style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#38bdf8',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                    fontWeight: '600'
                                  }}
                                >
                                  @ Responder
                                </button>
                                {c.stance && (
                                  <span style={{
                                    backgroundColor: stanceBg,
                                    color: stanceColor,
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {stanceText}
                                  </span>
                                )}
                              </div>
                            </div>

                            {renderCommentContent(c.content)}

                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                              {c.created_at ? new Date(c.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Formulario de Comentario */}
                  {(proposalDetail.status === 'debate' || proposalDetail.status === 'voting') && (
                    <form onSubmit={handleSendComment} style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Tu postura o intervención:</div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'favor', label: '👍 A favor' },
                          { key: 'contra', label: '👎 En contra' },
                          { key: 'duda', label: '🤔 Con dudas' },
                          { key: 'opinión', label: '💬 Opinión' },
                        ].map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => setCommentStance(s.key)}
                            style={{
                              backgroundColor: commentStance === s.key ? '#2563eb' : '#1e293b',
                              border: commentStance === s.key ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: commentStance === s.key ? '#ffffff' : '#94a3b8',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {replyingTo && (
                        <div style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#38bdf8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px'
                        }}>
                          <span>↩️ Respondiendo a <strong>@{replyingTo}</strong></span>
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                            onClick={() => {
                              setReplyingTo(null);
                              setCommentText(prev => prev.replace(`@${replyingTo} `, '').replace(`@${replyingTo}`, ''));
                            }}
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      )}

                      <textarea
                        ref={commentInputRef}
                        rows={2}
                        className="form-input"
                        placeholder={replyingTo ? `Responde a @${replyingTo}...` : "Escribe tu argumento o pregunta para la asamblea..."}
                        value={commentText}
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          if (replyingTo && !e.target.value.includes(`@${replyingTo}`)) {
                            setReplyingTo(null);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          color: '#fff',
                          fontSize: '13px',
                          marginBottom: '8px',
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="submit"
                          disabled={submittingComment || !commentText.trim()}
                          style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            opacity: (!commentText.trim() || submittingComment) ? 0.6 : 1,
                          }}
                        >
                          {submittingComment ? 'Publicando...' : 'Publicar en Foro'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Desglose Nominativo de Votos */}
                {proposalDetail.status !== 'debate' && (
                  <div style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Registro de Votantes (Nominativo)
                    </div>
                    {!proposalDetail.votes_list || proposalDetail.votes_list.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>
                        Aún no se han emitido votos en esta asamblea.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {proposalDetail.votes_list.map((v, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: '#1e293b',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '12px',
                            }}
                          >
                            <span style={{ color: '#f8fafc', fontWeight: '600' }}>👤 {v.voter_name}</span>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: '700',
                              backgroundColor: v.choice === 'si' ? '#065f46' : v.choice === 'no' ? '#881337' : '#334155',
                              color: v.choice === 'si' ? '#34d399' : v.choice === 'no' ? '#f87171' : '#cbd5e1',
                            }}>
                              {v.choice.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    width: '100%',
                    backgroundColor: '#334155',
                    color: '#f8fafc',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  Volver a la Lista
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
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
                  Parentesco / Vínculo *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: Hermano, Hijo, Tío, Primo"
                  value={candidateRelation}
                  onChange={(e) => setCandidateRelation(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Teléfono de Contacto (opcional)
                </label>
                <input
                  type="tel"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: +58 412 1234567"
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Motivo / Justificación *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Explica las razones para proponer el ingreso de este familiar a la mutual"
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
                  style={{ backgroundColor: '#0284c7', border: 'none' }}
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#f87171' }}>⚠️ Proponer Expulsión de Miembro</h3>
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
    </div>
  );
};

export default MembersList;
