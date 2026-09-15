import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gobernanzaApi, membershipApi, useAuthStore, useConfigStore } from '@civiccore/sdk';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Clock, ShieldAlert } from 'lucide-react';

const ProposalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { terminology } = useConfigStore();
  const [proposal, setProposal] = useState(null);
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [optInExit, setOptInExit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editReason, setEditReason] = useState('');
  
  const [isEditingDefense, setIsEditingDefense] = useState(false);
  const [editDefenseText, setEditDefenseText] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    fetchProposalData();
  }, [id]);

  const fetchProposalData = async () => {
    try {
      const propData = await gobernanzaApi.obtenerPropuesta(id);
      setProposal(propData);
      setEditTitle(propData.title);
      setEditContent(propData.content);
      const commentsData = await gobernanzaApi.listarComentarios(id);
      setComments(commentsData);
      const versionsData = await gobernanzaApi.obtenerVersiones(id);
      setVersions(versionsData);
    } catch (error) {
      console.error(error);
    }
  };

  const handleVote = async (value) => {
    if (!window.confirm(`¿Estás seguro de votar ${value === 1 ? 'A Favor' : 'En Contra'}?`)) return;
    
    try {
      setIsVoting(true);
      await gobernanzaApi.votar(id, value, 0);
      
      // Manejar el Voto Vinculante de Salida
      if (optInExit && value === -1) {
        try {
          await membershipApi.solicitarBaja();
        } catch (exitError) {
          console.error("Error solicitando salida:", exitError);
        }
      }

      alert('Voto registrado exitosamente');
      fetchProposalData(); // refresh
    } catch (error) {
      alert(error.message || 'Error al votar');
    } finally {
      setIsVoting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await gobernanzaApi.editarPropuesta(id, {
        title: editTitle,
        content: editContent,
        edit_reason: editReason
      });
      alert('Propuesta actualizada exitosamente');
      setIsEditing(false);
      setEditReason('');
      fetchProposalData();
    } catch (error) {
      alert(error.response?.data?.detail || error.message || 'Error al editar');
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    try {
      await gobernanzaApi.crearComentario(id, newComment);
      setNewComment('');
      fetchProposalData();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('No se pudo añadir el comentario');
    }
  };

  const handleDefenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await gobernanzaApi.editarDefensa(id, editDefenseText);
      setIsEditingDefense(false);
      fetchProposalData();
    } catch (error) {
      console.error('Error updating defense:', error);
      alert('Error al actualizar el derecho a réplica');
    }
  };

  if (!proposal) return <div className="p-8 text-center"><div className="loader"></div></div>;

  const totalVotes = (proposal.votes_yes || 0) + (proposal.votes_no || 0) + (proposal.votes_abstain || 0);
  const quorumProgress = Math.min(100, Math.round((totalVotes / proposal.quorum_needed) * 100));

  let timeLeftText = "Debate Abierto";
  if (proposal.status === 'voting' && proposal.voting_ends_at) {
    const ends = new Date(proposal.voting_ends_at);
    const now = new Date();
    const diffDays = Math.ceil((ends - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) timeLeftText = `Quedan ${diffDays} días para votar`;
    else timeLeftText = "Finalizando hoy";
  } else if (proposal.status === 'approved') {
    timeLeftText = "Aprobada";
  } else if (proposal.status === 'rejected') {
    timeLeftText = "Rechazada";
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <button 
        className="btn btn-secondary mb-6" 
        onClick={() => navigate('/governance')}
        style={{ border: 'none', padding: '0', background: 'transparent', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} /> Volver a {terminology.governance}
      </button>

      {proposal.category === 'configuracion' && (
        <div className="glass-panel mb-6" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '1rem' }}>
          <div className="flex items-center gap-3 text-orange">
            <ShieldAlert size={24} />
            <div>
              <h4 className="font-medium">Regla Constitucional Activa</h4>
              <p className="text-sm opacity-80">Esta propuesta requiere una mayoría del 50%+1 y el mecanismo de votación está forzado a SIMPLE.</p>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel mb-8" style={{ padding: '2.5rem' }}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3 items-center">
            <div className="badge badge-blue">{proposal.status}</div>
            {versions.length > 0 && (
              <button 
                onClick={() => setShowVersions(!showVersions)}
                className="badge" style={{ cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
              >
                Historial: {versions.length} ediciones previas
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border-strong)' }}>
              <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              {timeLeftText}
            </span>
            <span className="text-muted text-sm">
              Creado el {new Date(proposal.created_at).toLocaleDateString()}
            </span>
            {user?.id === proposal.author_id && proposal.status === 'debate' && !isEditing && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(true)}
              >
                Editar Propuesta
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mb-8 p-4" style={{ background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
            <h3 className="mb-4">Editando Propuesta</h3>
            <div className="form-group mb-4">
              <label className="form-label">Título</label>
              <input type="text" className="form-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Contenido</label>
              <textarea className="form-input" rows="8" value={editContent} onChange={(e) => setEditContent(e.target.value)} required />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Motivo del cambio (opcional)</label>
              <input type="text" className="form-input" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Ej. Aclaración a petición de la asamblea" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="page-title mb-6">{proposal.title}</h1>
            
            <div className="prose text-secondary mb-8" style={{ fontSize: '1.125rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {proposal.content}
            </div>
          </>
        )}

        {showVersions && versions.length > 0 && (
          <div className="mb-8 p-6" style={{ background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
            <h3 className="mb-4">Historial de Versiones</h3>
            {versions.map(v => (
              <div key={v.id} className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Versión {v.version_number}</span>
                  <span className="text-muted text-sm">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.is_substantial && <div className="badge badge-orange mb-2">Cambio Sustancial (Alerta enviada)</div>}
                {v.edit_reason && <p className="text-sm italic mb-2 text-muted">Motivo: {v.edit_reason}</p>}
                <div className="p-3 bg-card-bg rounded" style={{ fontSize: '0.875rem' }}>
                  <h4 className="font-medium mb-1">{v.title}</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{v.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Defense Section for EXPULSION */}
        {proposal.proposal_type === 'expulsion' && (
          <div className="mb-8 p-6" style={{ background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-light)', borderLeft: '4px solid var(--warning-color, #f59e0b)' }}>
            <h3 className="mb-4 text-warning">Derecho a Réplica (Defensa)</h3>
            
            {proposal.defense_text ? (
              <div className="prose text-secondary mb-4" style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                {proposal.defense_text}
              </div>
            ) : (
              <p className="text-muted mb-4 italic">El miembro acusado aún no ha presentado su defensa.</p>
            )}
            
            {user?.id === proposal.target_member_id && (proposal.status === 'draft' || proposal.status === 'debate') && !isEditingDefense && (
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setEditDefenseText(proposal.defense_text || '');
                  setIsEditingDefense(true);
                }}
              >
                {proposal.defense_text ? 'Editar Defensa' : 'Añadir Defensa'}
              </button>
            )}
            
            {isEditingDefense && (
              <form onSubmit={handleDefenseSubmit} className="mt-4">
                <div className="form-group mb-4">
                  <textarea 
                    className="form-input" 
                    rows="6" 
                    value={editDefenseText} 
                    onChange={(e) => setEditDefenseText(e.target.value)} 
                    placeholder="Escribe aquí tu defensa frente a la asamblea..."
                    required 
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditingDefense(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar Defensa</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Voting Section */}
        {proposal.status === 'voting' && (
          <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '2rem', marginTop: '2rem' }}>
            <h3 className="mb-4">Emitir Voto</h3>
            <div className="flex gap-4">
              <button 
                className="btn btn-primary flex-1" 
                style={{ padding: '1rem', fontSize: '1rem' }}
                onClick={() => handleVote(1)}
                disabled={isVoting}
              >
                <ThumbsUp size={20} /> A Favor
              </button>
              <button 
                className="btn btn-danger flex-1" 
                style={{ padding: '1rem', fontSize: '1rem' }}
                onClick={() => handleVote(-1)}
                disabled={isVoting}
              >
                <ThumbsDown size={20} /> En Contra
              </button>
            </div>
            
            {proposal.category === 'CRITICAL' && (
              <div className="mt-4 p-4 rounded bg-red-50 text-red-800 flex gap-2 items-start" style={{ border: '1px solid #fecaca' }}>
                <input 
                  type="checkbox" 
                  id="optInExit" 
                  checked={optInExit}
                  onChange={(e) => setOptInExit(e.target.checked)}
                  style={{ marginTop: '0.25rem' }}
                />
                <label htmlFor="optInExit" className="text-sm cursor-pointer">
                  <strong>Voto Vinculante de Salida (Opt-in):</strong> Si esta propuesta se aprueba, solicito formalmente mi retiro y liquidación de haberes de la SVMM.
                </label>
              </div>
            )}
            
            <p className="text-muted mt-4 text-center" style={{ fontSize: '0.875rem' }}>
              Mecanismo: {proposal.voting_mechanism} | Quórum Actual: {totalVotes} / {proposal.quorum_needed} ({quorumProgress}%)
            </p>
          </div>
        )}
      </div>

      {/* Discussion Section */}
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h3 className="mb-6 flex items-center gap-2">
          <MessageSquare size={20} /> Discusión ({comments.length})
        </h3>
        
        <div className="comments-list mb-8">
          {comments.map(comment => (
            <div key={comment.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                  {comment.is_anonymous ? 'A' : (comment.author?.nombre?.charAt(0) || 'U')}
                </div>
                <div>
                  <div className="font-medium" style={{ fontSize: '0.875rem' }}>
                    {comment.is_anonymous ? 'Miembro Anónimo' : `${comment.author?.nombre} ${comment.author?.apellido}`}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-secondary" style={{ marginLeft: '2.75rem' }}>{comment.content}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-muted text-center py-4">Sé el primero en comentar.</p>}
        </div>

        <form onSubmit={handleCommentSubmit}>
          <div className="form-group mb-4">
            <textarea 
              className="form-input" 
              rows="3" 
              placeholder="Escribe tu argumento o pregunta..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              required
            ></textarea>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary">
              Publicar Comentario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProposalDetail;
