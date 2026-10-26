import React, { useState } from 'react';
import { useAuthStore } from '@civiccore/sdk';
import {
  Users,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Info,
  Code,
  CheckCircle,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';

const SUPPORT_EMAIL = 'mutualfam@gmail.com';
const APP_VERSION = '1.0.0';

export default function ProfileAndSettings() {
  const { user, activeOrg, logout } = useAuthStore();
  const envConfig = getEnvironmentConfig();

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (_) {
      const el = document.createElement('textarea');
      el.value = SUPPORT_EMAIL;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleSupportEmail = () => {
    const subject = encodeURIComponent(`[MutualFam Beta v${APP_VERSION}] Consulta o Reporte Beta`);
    const bodyLines = [
      'Escribe aquí tu consulta, duda o reporte:',
      '[Describe lo que necesitas o el fallo que experimentaste...]',
      '',
      '--------------------------------------------------',
      'Información técnica de diagnóstico (Beta):',
      `- Aplicación: Mutual Familiar`,
      `- Versión instalada: v${APP_VERSION}`,
      `- Entorno: ${envConfig.label || 'QA'}`,
      `- Dispositivo: Web Safari / Navegador Móvil`,
      `- Usuario: ${user?.email || 'No registrado'}`,
      `- Mutual activa: ${activeOrg?.name || 'Ninguna'}`,
      '--------------------------------------------------',
    ];
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMsg('Limpiando caché y descargando última versión...');
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) {}
    setTimeout(() => {
      window.location.href = window.location.origin + '/loans?v=' + Date.now();
    }, 600);
  };

  return (
    <div className="profile-container animate-fade-in">
      <h1 className="profile-screen-title">Perfil y Ajustes</h1>

      {/* Tarjeta 1: Mi Mutual Activa (Homologada con Android) */}
      <div className="profile-card">
        <div className="profile-card-header">
          <Users size={20} className="profile-icon-blue" />
          <h2 className="profile-card-title">Mi Mutual Activa</h2>
        </div>
        <p className="profile-card-text">
          Nombre: <strong className="profile-highlight-text">{activeOrg?.name || 'Ninguna seleccionada'}</strong>
        </p>
        <p className="profile-card-text" style={{ marginBottom: '0.85rem' }}>
          Rol: <strong className="profile-highlight-text">
            {activeOrg?.role === 'founder' ? 'Fundador' : activeOrg ? 'Miembro' : 'Sin mutual'}
          </strong>
        </p>
        <p className="profile-help-text">
          Si no puedes ver tus datos, es probable que tu sesión haya expirado o la base de datos se haya reiniciado.
        </p>
      </div>

      {/* Tarjeta 2: Soporte y Ayuda Beta (Homologada con Android) */}
      <div className="profile-card">
        <div className="profile-card-header">
          <MessageSquare size={20} className="profile-icon-green" />
          <h2 className="profile-card-title">Soporte y Ayuda Beta</h2>
        </div>
        <p className="profile-support-desc">
          ¿Tienes dudas, sugerencias o encontraste algún error en la aplicación? Como usuario beta, tu comunicación directa con el equipo es fundamental para mejorar la plataforma.
        </p>

        <button
          type="button"
          className="profile-support-btn"
          onClick={handleSupportEmail}
        >
          <Mail size={18} />
          <span>Contactar a Soporte por Email</span>
        </button>

        <div className="profile-email-row">
          <span className="profile-email-label">@</span>
          <span className="profile-email-text">{SUPPORT_EMAIL}</span>
          <button
            type="button"
            className="profile-copy-btn"
            onClick={handleCopyEmail}
            title="Copiar email de soporte"
          >
            {copiedEmail ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-blue-400" />}
          </button>
          {copiedEmail && <span className="profile-copy-toast">¡Copiado!</span>}
        </div>
      </div>

      {/* Tarjeta 3: Acerca de la App (Homologada con Android) */}
      <div className="profile-card">
        <div className="profile-card-header">
          <Info size={20} className="profile-icon-cyan" />
          <h2 className="profile-card-title">Acerca de la App</h2>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Aplicación</span>
          <span className="profile-about-value">Mutual Familiar</span>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Versión</span>
          <span className="profile-pill">v{APP_VERSION}</span>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Fase</span>
          <span className="profile-pill profile-pill--beta">Beta (Familias)</span>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Entorno</span>
          <EnvBadge size="small" />
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Desarrollador</span>
          <div className="profile-badge-author">
            <Code size={15} className="text-blue-400" />
            <span>Jorge Rojas</span>
          </div>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Analista de calidad</span>
          <div className="profile-badge-author">
            <CheckCircle size={15} className="text-green-400" />
            <span>Maira Salazar</span>
          </div>
        </div>

        <div className="profile-about-row">
          <span className="profile-about-label">Analista de calidad (iOS)</span>
          <div className="profile-badge-author">
            <CheckCircle size={15} className="text-green-400" />
            <span>Martín Vieira</span>
          </div>
        </div>

        <div className="profile-divider" />

        <button
          type="button"
          className="profile-update-btn"
          onClick={handleCheckUpdate}
          disabled={checkingUpdate}
        >
          <RefreshCw size={17} className={checkingUpdate ? 'animate-spin' : ''} />
          <span>{checkingUpdate ? 'Buscando actualizaciones...' : 'Buscar actualizaciones'}</span>
        </button>

        {updateMsg && (
          <p className="profile-update-feedback">{updateMsg}</p>
        )}
      </div>

      {/* Tarjeta 4: Opciones avanzadas y cuenta (plegable limpia) */}
      <div className="profile-card profile-card--collapsible">
        <button
          type="button"
          className="profile-collapse-header"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-secondary" />
            <span className="text-sm font-semibold text-secondary">Información Personal y Cuenta</span>
          </div>
          {showAdvanced ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
        </button>

        {showAdvanced && (
          <div className="profile-advanced-content animate-fade-in">
            <div className="profile-about-row">
              <span className="profile-about-label">Nombre</span>
              <span className="profile-about-value">{user?.nombre} {user?.apellido}</span>
            </div>
            <div className="profile-about-row">
              <span className="profile-about-label">Correo</span>
              <span className="profile-about-value text-xs">{user?.email}</span>
            </div>
            {user?.cedula && (
              <div className="profile-about-row">
                <span className="profile-about-label">Cédula</span>
                <span className="profile-about-value">{user.cedula}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón de Cerrar Sesión */}
      <button
        type="button"
        className="profile-logout-btn"
        onClick={logout}
      >
        <LogOut size={18} />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  );
}
