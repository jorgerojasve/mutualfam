import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import { Users, Plus, Key, LogOut, ArrowRight, Check, Sparkles } from 'lucide-react';
import { EnvBadge } from '../../components/Common/EnvBadge';

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');

export default function SelectMutual() {
  const navigate = useNavigate();
  const { user, organizations, activeOrg, selectOrg, joinOrg, createOrg, logout, refreshUser } = useAuthStore();
  
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
    refreshUser();
  }, []);

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
      await joinOrg(inviteCode.trim());
      setJoinSuccess('¡Te has unido exitosamente!');
      setTimeout(() => {
        setModalMode(null);
        navigate('/loans');
      }, 900);
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 max-w-lg mx-auto">
      <div className="w-full">
        <div className="flex items-center justify-between mb-6 pt-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Mis Mutuales
          </h1>
          <EnvBadge size="small" />
        </div>

        {organizations && organizations.length > 0 ? (
          <div className="flex flex-col gap-3 mb-6">
            {organizations.map((org) => {
              const isSelected = activeOrg?.id === org.id;
              return (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500/60 bg-blue-500/10 shadow-lg shadow-blue-500/5'
                      : 'border-white/10 hover:border-white/20 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      {initialOf(org.name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-base leading-snug">
                        {org.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Rol: {org.role === 'founder' ? 'Fundador' : 'Miembro'}
                      </p>
                    </div>
                  </div>
                  {isSelected ? (
                    <Check size={20} className="text-blue-400" />
                  ) : (
                    <ArrowRight size={18} className="text-slate-500" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-center mb-6">
            <p className="text-slate-300 font-medium mb-1">
              Aún no perteneces a ninguna familia/mutual.
            </p>
            <p className="text-xs text-slate-500">
              Si alguien te invitó, haz clic en "Tengo un código de invitación" y escribe el código recibido.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pb-6">
        <button
          type="button"
          onClick={() => setModalMode('join')}
          className="btn btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm"
        >
          <Key size={18} />
          <span>Tengo un código de invitación</span>
        </button>

        <button
          type="button"
          onClick={() => setModalMode('create')}
          className="btn btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm"
        >
          <Plus size={18} />
          <span>Crear una nueva mutual</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="text-xs text-red-400 hover:text-red-300 py-3 flex items-center justify-center gap-2 font-medium"
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Modal / Dialog para Crear o Unirse */}
      {modalMode && (
        <div className="modal-backdrop" onClick={() => setModalMode(null)}>
          <div className="mutual-modal-content" onClick={(e) => e.stopPropagation()}>
            {modalMode === 'create' ? (
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                  <Sparkles size={20} className="text-blue" />
                  Crear mi Mutual
                </h3>
                <p className="text-xs text-secondary mb-3">
                  Inicia tu propia familia y administra sus préstamos y fondos.
                </p>

                <div className="mutual-policy-notice mb-3">
                  <p>
                    📌 Cada miembro de la mutual inicial puede crear hasta 1 mutual adicional. Si deseas desplegar tu propia instancia o bot, contáctanos por soporte.
                  </p>
                </div>

                <form onSubmit={handleCreate}>
                  <div className="form-group mb-3">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Nombre de la familia *
                    </label>
                    <input
                      type="text"
                      className="form-input text-sm w-full"
                      placeholder="Nombre de la familia (ej. Familia Pérez)"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Descripción (Opcional)
                    </label>
                    <textarea
                      className="form-input text-sm w-full"
                      rows={3}
                      placeholder="Describe el propósito o miembros..."
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                    />
                  </div>
                  {createError && <p className="text-xs text-red-400 mb-3">{createError}</p>}
                  {createSuccess && <p className="text-xs text-green-400 mb-3">{createSuccess}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 py-2 text-sm"
                      onClick={() => setModalMode(null)}
                      disabled={createLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1 py-2 text-sm"
                      disabled={createLoading || !createName.trim()}
                    >
                      {createLoading ? 'Creando...' : 'Crear Mutual'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                  <Key size={20} className="text-blue" />
                  Unirme con código
                </h3>
                <p className="text-xs text-secondary mb-3">
                  Ingresa el código o token de invitación que te hayan compartido.
                </p>
                <form onSubmit={handleJoin}>
                  <div className="form-group mb-3">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Código de invitación *
                    </label>
                    <input
                      type="text"
                      className="form-input text-sm w-full"
                      placeholder="Código o token (ej. MF-XXXX)"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {joinError && <p className="text-xs text-red-400 mb-3">{joinError}</p>}
                  {joinSuccess && <p className="text-xs text-green-400 mb-3">{joinSuccess}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 py-2 text-sm"
                      onClick={() => setModalMode(null)}
                      disabled={joinLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1 py-2 text-sm"
                      disabled={joinLoading || !inviteCode.trim()}
                    >
                      {joinLoading ? 'Uniendo...' : 'Unirme'}
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
