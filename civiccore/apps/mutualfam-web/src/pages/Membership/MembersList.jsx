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
    <div className="page-panel animate-fade-in pb-12">
      <div className="flex justify-between items-center page-header-row mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title flex items-center gap-3 text-gradient" style={{ margin: 0 }}>
            <Users className="text-blue" size={26} />
            Directorio de Miembros
          </h1>
          <p className="text-secondary mt-1 text-sm">
            {activeOrg ? `Mutual: ${activeOrg.name}` : 'Nuestra red de ayuda mutua y gobernanza solidaria.'}
          </p>
        </div>

        {activeOrg?.role === 'founder' && (
          <button
            type="button"
            className="btn btn-primary text-sm flex items-center gap-2"
            onClick={handleGenerateInvite}
            disabled={generatingInvite}
          >
            <UserPlus size={16} />
            <span>{generatingInvite ? 'Generando...' : 'Invitar a Familiar'}</span>
          </button>
        )}
      </div>

      {!activeOrg ? (
        <div className="glass-card p-8 text-center border border-white/5 my-4">
          <Users size={36} className="text-muted mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">No tienes una mutual activa seleccionada</h3>
          <p className="text-sm text-secondary max-w-md mx-auto">
            Selecciona tu mutual en la barra superior o ingresa tu código de invitación para ver a los miembros de tu familia.
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card p-4 mb-6 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={17} />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                className="form-input pl-10 bg-black/40 border-white/10 w-full text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-secondary" size={16} />
              <select 
                className="form-input bg-black/40 border-white/10 text-sm py-1.5" 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="active">Activos</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center p-12"><div className="loader mx-auto"></div></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMembers.map(member => (
                <div key={member.id} className="glass-card p-5 flex flex-col items-center text-center hover:bg-white/5 transition-colors border border-white/5">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-900 to-slate-900 border-2 border-blue-500/50 rounded-full flex items-center justify-center text-xl font-bold text-white mb-3 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                    {member.nombre ? member.nombre.charAt(0).toUpperCase() : '?'}
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{member.nombre}</h3>
                  {member.email && (
                    <p className="text-secondary text-xs mb-3 truncate w-full" title={member.email}>{member.email}</p>
                  )}
                  
                  <div className="mt-auto pt-3 border-t border-white/10 w-full flex justify-between items-center text-xs">
                    {getStatusBadge(member.status)}
                    <span className="text-secondary font-mono bg-black/40 px-2 py-0.5 rounded">
                      {member.role === 'founder' ? '👑 Fundador' : 'Miembro'}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredMembers.length === 0 && (
                <div className="col-span-full p-10 text-center text-secondary bg-black/20 rounded-xl border border-white/5">
                  No se encontraron miembros con esos criterios de búsqueda.
                </div>
              )}
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
