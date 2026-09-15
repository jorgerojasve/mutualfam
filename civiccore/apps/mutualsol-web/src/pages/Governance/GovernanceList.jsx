import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gobernanzaApi, useConfigStore, delegatesApi } from '@civiccore/sdk';
import { Filter, CheckCircle, XCircle, Clock, Plus, Building, Users, Link as LinkIcon, Unlink } from 'lucide-react';
import BoardPage from './BoardPage';
import CommitteesPage from './CommitteesPage';

const GovernanceList = () => {
  const { terminology } = useConfigStore();
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('debate');
  
  // Delegation State
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateId, setDelegateId] = useState('');
  const [currentDelegate, setCurrentDelegate] = useState(null);
  const [isSubmittingDelegate, setIsSubmittingDelegate] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals();
    fetchMyDelegation();
  }, []);

  const fetchMyDelegation = async () => {
    try {
      const data = await delegatesApi.myDelegations();
      if (data && data.length > 0) {
        // Find if I have assigned a delegate to someone
        // Since myDelegations might return both directions, we usually just assign one delegate.
        // Assuming the API returns the delegate object directly if assigned:
        setCurrentDelegate(data[0]); 
      }
    } catch (e) {
      console.warn("Could not fetch delegation", e);
    }
  };

  const handleAssignDelegate = async () => {
    if (!delegateId) return alert('Ingresa el ID del miembro.');
    try {
      setIsSubmittingDelegate(true);
      await delegatesApi.assign({ delegate_id: parseInt(delegateId) });
      alert('Delegado asignado exitosamente.');
      setShowDelegateModal(false);
      fetchMyDelegation();
    } catch (error) {
      alert(error.message || 'Error al asignar delegado');
    } finally {
      setIsSubmittingDelegate(false);
    }
  };

  const handleRevokeDelegate = async () => {
    if (!currentDelegate) return;
    try {
      setIsSubmittingDelegate(true);
      await delegatesApi.revoke(currentDelegate.id);
      alert('Delegación revocada.');
      setCurrentDelegate(null);
    } catch (error) {
      alert(error.message || 'Error al revocar');
    } finally {
      setIsSubmittingDelegate(false);
    }
  };

  const fetchProposals = async () => {
    try {
      setIsLoading(true);
      const data = await gobernanzaApi.listarPropuestas();
      setProposals(data);
    } catch (error) {
      console.error("Error fetching proposals", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VOTING': return <span className="badge badge-blue">Votación Activa</span>;
      case 'DEBATE': return <span className="badge badge-orange">En Debate</span>;
      case 'APPROVED': return <span className="badge badge-green">Aprobado</span>;
      case 'REJECTED': return <span className="badge badge-orange">Rechazado</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getCategoryLabel = (category, type) => {
    if (type === 'expulsion') return <span className="text-red-500 font-bold">🔴 Expulsión (75%)</span>;
    if (type === 'division') return <span className="text-blue-500 font-bold">🔵 División (75%)</span>;
    if (type === 'fusion') return <span className="text-yellow-500 font-bold">🟡 Fusión (66%)</span>;
    return category === 'configuracion' ? 'Regla de Sistema' : 'Propuesta General';
  };

  const filteredProposals = proposals.filter(p => 
    activeTab === 'debate' ? p.status === 'debate' : p.status !== 'debate'
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">{terminology.governance}</h1>
          <p className="text-secondary">Decide el futuro del fondo mutual.</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={() => setShowDelegateModal(true)}>
            <Users size={18} />
            Delegar Mi Voto
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/governance/create')}>
            <Plus size={18} />
            Nueva Propuesta
          </button>
        </div>
      </div>

      <div className="flex" style={{ borderBottom: '1px solid var(--border-light)', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('debate')}
          style={{ 
            padding: '1rem 2rem', 
            background: 'transparent', 
            border: 'none', 
            color: activeTab === 'debate' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'debate' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'debate' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          Foro de Debate
        </button>
        <button 
          onClick={() => setActiveTab('referendos')}
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            color: activeTab === 'referendos' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'referendos' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'referendos' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          Referendos
        </button>
        <button 
          onClick={() => setActiveTab('junta')}
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            color: activeTab === 'junta' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'junta' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'junta' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          <Building size={16} className="inline mr-2" />
          Junta Directiva
        </button>
        <button 
          onClick={() => setActiveTab('comites')}
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            color: activeTab === 'comites' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'comites' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'comites' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          <Users size={16} className="inline mr-2" />
          Comités
        </button>
      </div>

      {activeTab === 'junta' ? (
        <BoardPage />
      ) : activeTab === 'comites' ? (
        <CommitteesPage />
      ) : isLoading ? (
        <div className="flex justify-center mt-8">
          <div className="loader">Cargando...</div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {filteredProposals.length === 0 ? (
            <p className="text-muted">No hay elementos en esta sección.</p>
          ) : (
            filteredProposals.map(proposal => (
              <div 
                key={proposal.id} 
                className="glass-card" 
                style={{ padding: '1.5rem', cursor: 'pointer' }}
                onClick={() => navigate(`/governance/${proposal.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(proposal.status)}
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>#{proposal.id}</span>
                </div>
                
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>{proposal.title}</h3>
                <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {proposal.content}
                </p>
                
                <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} /> 
                    {new Date(proposal.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-muted font-medium" style={{ fontSize: '0.75rem' }}>
                    {getCategoryLabel(proposal.category, proposal.proposal_type)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delegation Modal */}
      {showDelegateModal && (
        <div className="modal-overlay" onClick={() => setShowDelegateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Delegación Líquida de Voto</h2>
              <button className="text-muted hover:text-white" onClick={() => setShowDelegateModal(false)}>
                <XCircle size={24} />
              </button>
            </div>
            
            <p className="text-secondary mb-6 text-sm">
              En MutualSol puedes delegar tu poder de voto en otra persona de confianza. 
              Si esa persona vota, tu voto sumará automáticamente en el mismo sentido, a menos que tú votes directamente, en cuyo caso tu voto directo anulará la delegación.
            </p>

            {currentDelegate ? (
              <div className="glass-card p-6 border-l-4 border-l-accent mb-4">
                <h3 className="font-bold text-lg text-accent mb-2">Delegación Activa</h3>
                <p className="text-white mb-1">Has delegado tu voto al Miembro #{currentDelegate.delegate_id}</p>
                <p className="text-muted text-xs mb-4">La delegación estará activa hasta que decidas revocarla o votes manualmente.</p>
                
                <button 
                  className="btn bg-red-500/20 text-red-400 hover:bg-red-500/40 w-full justify-center"
                  onClick={handleRevokeDelegate}
                  disabled={isSubmittingDelegate}
                >
                  <Unlink size={18} className="mr-2" />
                  Revocar Delegación
                </button>
              </div>
            ) : (
              <div>
                <label className="form-label">ID del Miembro Delegado</label>
                <input 
                  type="number" 
                  className="form-input mb-6" 
                  placeholder="Ej. 42"
                  value={delegateId}
                  onChange={e => setDelegateId(e.target.value)}
                />
                
                <button 
                  className="btn btn-primary w-full justify-center"
                  onClick={handleAssignDelegate}
                  disabled={isSubmittingDelegate}
                >
                  <LinkIcon size={18} className="mr-2" />
                  {isSubmittingDelegate ? 'Asignando...' : 'Asignar Delegado'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GovernanceList;
