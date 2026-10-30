import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@civiccore/sdk';
import {
  ChevronsUpDown,
  Check,
  Plus,
  Users,
  X,
  Sparkles,
  PlusCircle,
  ArrowLeft,
  Key
} from 'lucide-react';
import { EnvBadge } from '../Common/EnvBadge';

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');
const roleLabel = (role) => (role === 'founder' ? 'Fundador' : 'Miembro');

export default function MutualSwitcher() {
  const { activeOrg, organizations, selectOrg, joinOrg, createOrg } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'manage' | 'create' | 'join'

  // Estado para unirse
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Estado para crear
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const handleClose = () => {
    setIsOpen(false);
    setView('list');
    setJoinError('');
    setJoinSuccess('');
    setCreateError('');
    setCreateSuccess('');
  };

  const handleSelect = async (org) => {
    await selectOrg(org);
    handleClose();
    // Recargar página para sincronizar préstamos, fondos y miembros
    window.location.reload();
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
      setInviteCode('');
      setTimeout(() => {
        handleClose();
        window.location.reload();
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
      setCreateSuccess('¡Mutual creada exitosamente! Tienes 24 horas para invitar a tus familiares libremente.');
      setCreateName('');
      setCreateDescription('');
      setTimeout(() => {
        handleClose();
        window.location.reload();
      }, 1100);
    } catch (err) {
      setCreateError(err?.message || 'No se pudo crear la mutual');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      {/* Gatillo visual en el Topbar (homologado con Android) */}
      <button
        type="button"
        className="mutual-switcher-trigger"
        onClick={() => setIsOpen(true)}
        aria-label={`Mutual activa: ${activeOrg?.name || 'ninguna'}. Toca para cambiar`}
      >
        <div className="mutual-avatar">
          {initialOf(activeOrg?.name)}
        </div>
        <div className="mutual-labels">
          <span className="mutual-caption">MUTUAL ACTIVA</span>
          <span className="mutual-name">
            {activeOrg ? activeOrg.name : 'Seleccionar mutual'}
          </span>
        </div>
        <div className="mutual-badges">
          <span className="badge-beta">BETA</span>
          <EnvBadge size="small" />
        </div>
        <ChevronsUpDown size={18} className="mutual-swap-icon" />
      </button>

      {/* Modal / Bottom Sheet para cambiar, crear o unirse a una mutual */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={handleClose}>
          <div
            className="mutual-modal-content glass-card animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador visual estilo Android en dispositivos móviles */}
            <div className="sheet-handle" />

            {/* VISTA 1: Lista de mutuales (por defecto) */}
            {view === 'list' && (
              <>
                <div className="mutual-modal-header">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users size={20} className="text-blue" />
                      Cambiar de mutual
                    </h3>
                    <p className="text-xs text-secondary mt-1">
                      La mutual elegida se aplica a toda la app: préstamos, fondos y familia.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-icon text-secondary hover:text-white"
                    onClick={handleClose}
                    aria-label="Cerrar modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Lista de mutuales del usuario */}
                <div className="mutual-list">
                  {organizations && organizations.length > 0 ? (
                    organizations.map((org) => {
                      const isSelected = activeOrg?.id === org.id;
                      return (
                        <div
                          key={org.id}
                          className={`mutual-item ${isSelected ? 'mutual-item--active' : ''}`}
                          onClick={() => handleSelect(org)}
                        >
                          <div className={`mutual-item-avatar ${!isSelected ? 'mutual-item-avatar--muted' : ''}`}>
                            {initialOf(org.name)}
                          </div>
                          <div className="mutual-item-info">
                            <span className="mutual-item-name">{org.name}</span>
                            <span className="mutual-item-role">{roleLabel(org.role)}</span>
                          </div>
                          {isSelected && (
                            <Check size={20} className="text-blue font-bold" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-sm text-secondary bg-black/20 rounded-xl border border-white/5">
                      Aún no perteneces a ninguna mutual. Puedes crear una nueva mutual familiar o unirte con un código de invitación.
                    </div>
                  )}
                </div>

                {/* Botón inferior homologado con Android */}
                <div className="mutual-modal-footer">
                  <button
                    type="button"
                    className="mutual-manage-link"
                    onClick={() => setView('manage')}
                  >
                    <PlusCircle size={19} className="text-blue" />
                    <span>Crear, unirse o gestionar mutuales</span>
                  </button>
                </div>
              </>
            )}

            {/* VISTA 2: Menú de gestión (Crear o Unirse) */}
            {view === 'manage' && (
              <>
                <div className="mutual-modal-header">
                  <div>
                    <button
                      type="button"
                      className="text-xs text-blue flex items-center gap-1 mb-1 font-semibold hover:underline"
                      onClick={() => setView('list')}
                    >
                      <ArrowLeft size={14} />
                      Volver a mis mutuales
                    </button>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles size={20} className="text-blue" />
                      Gestionar mutuales
                    </h3>
                    <p className="text-xs text-secondary mt-1">
                      Crea una nueva mutual familiar o únete a una existente con un código.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-icon text-secondary hover:text-white"
                    onClick={handleClose}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mutual-manage-options">
                  <button
                    type="button"
                    className="mutual-option-card"
                    onClick={() => setView('create')}
                  >
                    <div className="mutual-option-icon bg-blue/15 text-blue border border-blue/30">
                      <Plus size={22} />
                    </div>
                    <div className="mutual-option-text">
                      <span className="mutual-option-title">Crear una nueva mutual</span>
                      <span className="mutual-option-desc">
                        Inicia tu propia familia y administra sus préstamos y fondos.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="mutual-option-card"
                    onClick={() => setView('join')}
                  >
                    <div className="mutual-option-icon bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      <Key size={20} />
                    </div>
                    <div className="mutual-option-text">
                      <span className="mutual-option-title">Tengo un código de invitación</span>
                      <span className="mutual-option-desc">
                        Únete a una mutual existente ingresando el código recibido.
                      </span>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* VISTA 3: Formulario para Crear Mutual */}
            {view === 'create' && (
              <>
                <div className="mutual-modal-header">
                  <div>
                    <button
                      type="button"
                      className="text-xs text-blue flex items-center gap-1 mb-1 font-semibold hover:underline"
                      onClick={() => setView('manage')}
                    >
                      <ArrowLeft size={14} />
                      Volver
                    </button>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles size={20} className="text-blue" />
                      Crear mi Mutual
                    </h3>
                    <p className="text-xs text-secondary mt-1">
                      Inicia tu propia familia y administra sus préstamos y fondos.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-icon text-secondary hover:text-white"
                    onClick={handleClose}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mutual-policy-notice">
                  <p>
                    📌 Cada miembro de la mutual inicial puede crear hasta 1 mutual adicional. Si deseas desplegar tu propia instancia o bot, contáctanos por soporte.
                  </p>
                </div>

                <form onSubmit={handleCreate} className="mutual-create-form mt-3">
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
                      placeholder="Describe el propósito o miembros de esta mutual..."
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                    />
                  </div>

                  {createError && (
                    <div className="p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                      {createError}
                    </div>
                  )}

                  {createSuccess && (
                    <div className="p-3 mb-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
                      {createSuccess}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-sm py-2"
                      onClick={() => setView('manage')}
                      disabled={createLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1 text-sm py-2"
                      disabled={createLoading || !createName.trim()}
                    >
                      {createLoading ? 'Creando...' : 'Crear Mutual'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* VISTA 4: Formulario para Unirse con Código */}
            {view === 'join' && (
              <>
                <div className="mutual-modal-header">
                  <div>
                    <button
                      type="button"
                      className="text-xs text-blue flex items-center gap-1 mb-1 font-semibold hover:underline"
                      onClick={() => setView('manage')}
                    >
                      <ArrowLeft size={14} />
                      Volver
                    </button>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Key size={20} className="text-blue" />
                      Unirme con código
                    </h3>
                    <p className="text-xs text-secondary mt-1">
                      Ingresa el código o token de invitación que te hayan compartido.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-icon text-secondary hover:text-white"
                    onClick={handleClose}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleJoin} className="mutual-join-form mt-2">
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

                  {joinError && (
                    <div className="p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                      {joinError}
                    </div>
                  )}

                  {joinSuccess && (
                    <div className="p-3 mb-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
                      {joinSuccess}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-sm py-2"
                      onClick={() => setView('manage')}
                      disabled={joinLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1 text-sm py-2"
                      disabled={joinLoading || !inviteCode.trim()}
                    >
                      {joinLoading ? 'Uniendo...' : 'Unirme'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
