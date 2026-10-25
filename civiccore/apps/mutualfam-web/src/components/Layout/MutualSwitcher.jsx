import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore, membershipApi } from '@civiccore/sdk';
import { ChevronsUpDown, Check, Plus, Users, X, Sparkles } from 'lucide-react';
import { EnvBadge } from '../Common/EnvBadge';

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');
const roleLabel = (role) => (role === 'founder' ? 'Fundador' : 'Miembro');

export default function MutualSwitcher() {
  const { activeOrg, organizations, selectOrg, joinOrg, refreshUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  const handleSelect = async (org) => {
    await selectOrg(org);
    setIsOpen(false);
    // Recargar página si es necesario para sincronizar consultas
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
        setIsOpen(false);
        setShowJoinInput(false);
        window.location.reload();
      }, 900);
    } catch (err) {
      setJoinError(err?.message || 'Código de invitación inválido o expirado');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <>
      {/* Gatillo visual que replica fielmente el header de la APK Android */}
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

      {/* Modal / Bottom Sheet para cambiar o unirse a una mutual */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="mutual-modal-content glass-card animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
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
                onClick={() => setIsOpen(false)}
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
                        <Check size={20} className="text-blue" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-sm text-secondary bg-black/20 rounded-xl border border-white/5">
                  Aún no perteneces a ninguna mutual. Ingresa tu código de invitación para unirte.
                </div>
              )}
            </div>

            {/* Sección para unirse con código */}
            <div className="mutual-modal-actions">
              {!showJoinInput ? (
                <button
                  type="button"
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  onClick={() => setShowJoinInput(true)}
                >
                  <Plus size={16} />
                  <span>Unirme con código de invitación</span>
                </button>
              ) : (
                <form onSubmit={handleJoin} className="mutual-join-form">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="form-input text-sm flex-1"
                      placeholder="Código o token (ej. MF-XXXX)"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={joinLoading || !inviteCode.trim()}
                      className="btn btn-primary text-sm whitespace-nowrap"
                    >
                      {joinLoading ? 'Uniendo...' : 'Unirme'}
                    </button>
                  </div>
                  {joinError && <p className="text-xs text-red-400 mt-2">{joinError}</p>}
                  {joinSuccess && <p className="text-xs text-green-400 mt-2">{joinSuccess}</p>}
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
