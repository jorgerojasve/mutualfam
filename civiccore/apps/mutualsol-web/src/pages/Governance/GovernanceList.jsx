import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gobernanzaApi, useConfigStore } from '@civiccore/sdk';
import { Filter, CheckCircle, XCircle, Clock, Plus, Building, Users } from 'lucide-react';
import BoardPage from './BoardPage';
import CommitteesPage from './CommitteesPage';

const GovernanceList = () => {
  const { terminology } = useConfigStore();
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('debate');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProposals();
  }, []);

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
        <button className="btn btn-primary" onClick={() => navigate('/governance/create')}>
          <Plus size={18} />
          Nueva Propuesta
        </button>
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
    </div>
  );
};

export default GovernanceList;
