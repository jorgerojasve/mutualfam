import React, { useEffect, useState } from 'react';
import { membershipApi } from '@civiccore/sdk';
import { Users, Search, Filter } from 'lucide-react';

const MembersList = () => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.getMembers();
      setMembers(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar miembros");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.nombre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (m.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold border border-green-500/30">Activo</span>;
      case 'pending': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold border border-yellow-500/30">Pendiente</span>;
      case 'suspended': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold border border-red-500/30">Suspendido</span>;
      case 'withdrawn': return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-bold border border-gray-500/30">Retirado</span>;
      default: return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold border border-blue-500/30">{status}</span>;
    }
  };

  return (
    <div className="animate-fade-in pb-12">
      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-3">
          <Users className="text-blue" size={28} />
          Directorio de Miembros
        </h1>
        <p className="text-secondary mt-2">Nuestra red de ayuda mutua y gobernanza solidaria.</p>
      </div>

      <div className="glass-card p-4 mb-8 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            className="form-input pl-10 bg-black/40 border-white/10 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-secondary" size={18} />
          <select 
            className="form-input bg-black/40 border-white/10" 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes</option>
            <option value="suspended">Suspendidos</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-12"><div className="loader mx-auto"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map(member => (
            <div key={member.id} className="glass-card p-6 flex flex-col items-center text-center hover:bg-white/5 transition-colors border border-white/5">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-900 to-black border-2 border-blue-500/50 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                {member.nombre ? member.nombre.charAt(0).toUpperCase() : '?'}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{member.nombre || 'Sin Nombre'}</h3>
              <p className="text-secondary text-sm mb-4 truncate w-full" title={member.email}>{member.email}</p>
              
              <div className="mt-auto pt-4 border-t border-white/10 w-full flex justify-between items-center">
                {getStatusBadge(member.status)}
                <span className="text-xs text-secondary font-mono bg-black/50 px-2 py-1 rounded">
                  {member.role === 'admin' ? '⭐ Admin' : 'Socio'}
                </span>
              </div>
            </div>
          ))}
          
          {filteredMembers.length === 0 && (
            <div className="col-span-full p-12 text-center text-secondary bg-black/20 rounded-xl border border-white/5">
              No se encontraron miembros con esos criterios de búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MembersList;
