import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { committeesApi } from '@civiccore/sdk';
import { Network, Plus, Users, Layout } from 'lucide-react';

const CommitteesPage = () => {
  const [committees, setCommittees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCommittees();
  }, []);

  const fetchCommittees = async () => {
    try {
      setIsLoading(true);
      const data = await committeesApi.list();
      setCommittees(data);
    } catch (error) {
      console.error("Error fetching committees", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Comités Especializados</h2>
          <p className="text-secondary text-sm">Grupos de trabajo con autoridad delegada.</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/governance/create?type=committee')}>
          <Plus size={16} />
          Proponer Comité
        </button>
      </div>

      {isLoading ? (
        <div className="loader">Cargando...</div>
      ) : committees.length === 0 ? (
        <div className="glass-card p-8 text-center border border-dashed border-gray-600/30">
          <Network size={48} className="mx-auto text-gray-500/50 mb-4" />
          <p className="text-secondary">No hay comités activos actualmente.</p>
          <p className="text-xs text-gray-500 mt-2">Cualquier miembro puede proponer la creación de un nuevo comité.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {committees.map(c => (
            <div key={c.id} className="glass-card p-6 border-l-2 border-l-blue-500 hover:-translate-y-1 transition-transform cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Layout size={20} />
                </div>
                {c.is_active && <span className="badge badge-blue text-xs">Activo</span>}
              </div>
              <h3 className="font-bold text-lg mb-1">{c.name}</h3>
              <p className="text-secondary text-sm mb-4">{c.area || 'Área General'}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-muted text-xs">
                  <Users size={14} />
                  <span>{c.members ? c.members.length : 0} Miembros</span>
                </div>
                <button className="text-blue-400 text-xs hover:underline font-medium">
                  Ver Detalles →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommitteesPage;
