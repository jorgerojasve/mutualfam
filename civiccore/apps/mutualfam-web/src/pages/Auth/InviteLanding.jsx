import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  UserPlus,
  Users,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import './InviteLanding.css';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';

const API_URL = import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1';

// Enlace Mágico: el backend siempre redirige a la última versión del APK
// publicada en GitHub, sin que tengamos que actualizar esta página web.
const DOWNLOAD_APK_LINK = `${API_URL}/config/latest-apk`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores sin Clipboard API (o sin HTTPS)
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

function Step({ number, icon: Icon, title, children, active }) {
  return (
    <li className={`il-step ${active ? 'il-step--active' : ''}`}>
      <div className="il-step__rail">
        <span className="il-step__number">{number}</span>
      </div>
      <div className="il-step__body">
        <h2 className="il-step__title">
          <Icon className="il-step__icon" aria-hidden="true" />
          {title}
        </h2>
        {children}
      </div>
    </li>
  );
}

export default function InviteLanding() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState(null); // { organization_name, code }
  const [status, setStatus] = useState(token ? 'loading' : 'direct'); // direct | loading | ok | invalid | offline
  const [toast, setToast] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadCooldownRef = useRef(false);
  const toastTimer = useRef(null);
  const envConfig = getEnvironmentConfig();

  useEffect(() => {
    if (token) {
      document.title = envConfig.isQA
        ? 'Invitación a Mutual Familiar (QA) | MutualFam'
        : 'Invitación a Mutual Familiar | MutualFam';
    } else {
      document.title = envConfig.isQA
        ? 'Descargar MutualFam (QA) - App Oficial Android'
        : 'Descargar MutualFam - App Oficial Android';
    }
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Descarga la app oficial de Mutual Familiar para Android y gestiona préstamos y aportes familiares.');
  }, [envConfig.isQA, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_URL}/membership/invites/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus('invalid');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setInvite(data);
        setStatus('ok');
      })
      .catch(() => !cancelled && setStatus('offline'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  const code = invite?.code || token;
  const orgName = invite?.organization_name;
  const deepLink = token ? `mutualfam://join/${invite?.token || token}` : 'mutualfam://';

  const handleCopyCode = async () => {
    if (await copyText(code)) {
      setCodeCopied(true);
      showToast('Código copiado');
      window.setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleDownload = (e) => {
    if (downloadCooldownRef.current) {
      if (e) e.preventDefault();
      return;
    }
    downloadCooldownRef.current = true;
    setIsDownloading(true);

    if (token) {
      copyText(window.location.href);
    }
    setDownloadStarted(true);

    // Evita doble activación por toques rápidos o reintentos inmediatos
    window.setTimeout(() => {
      downloadCooldownRef.current = false;
      setIsDownloading(false);
    }, 5000);
  };

  if (status === 'invalid') {
    return (
      <main className="il-page">
        <div className="il-bg" aria-hidden="true" />
        <section className="il-card il-card--center">
          <div className="il-badge il-badge--danger">
            <AlertTriangle aria-hidden="true" />
          </div>
          <h1 className="il-title">Invitación no válida</h1>
          <p className="il-lead">
            Esta invitación ya expiró o fue revocada. Pide a quien te invitó que te envíe una nueva.
          </p>
        </section>
        <p className="il-footer">Plataforma Cívica Mutual Familiar</p>
      </main>
    );
  }

  return (
    <main className="il-page">
      <div className="il-bg" aria-hidden="true" />

      <section className="il-card">
        {!envConfig.isProd && (
          <div style={{
            backgroundColor: envConfig.bgColor,
            border: `1px solid ${envConfig.borderColor}`,
            color: envConfig.color,
            borderRadius: '12px',
            padding: '0.65rem 1rem',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
            fontWeight: 600,
            lineHeight: 1.4,
          }}>
            {envConfig.bannerText}
          </div>
        )}

        <header className="il-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div className="il-badge">
              <Users aria-hidden="true" />
            </div>
            <EnvBadge size="medium" />
          </div>
          <p className="il-eyebrow">{token ? 'Tienes una invitación' : 'Aplicación Oficial Android'}</p>
          <h1 className="il-title">
            {status === 'loading' ? (
              <span className="il-skeleton" />
            ) : orgName ? (
              <>Te invitaron a <span className="il-gradient">{orgName}</span></>
            ) : token ? (
              <>Te invitaron a una <span className="il-gradient">Mutual Familiar</span></>
            ) : (
              <>Descarga <span className="il-gradient">{envConfig.appName}</span></>
            )}
          </h1>
          <p className="il-lead">
            {token
              ? 'Sigue estos 4 pasos. Te tomará unos 3 minutos.'
              : 'Sigue estos sencillos pasos para instalar la aplicación en tu dispositivo móvil.'}
          </p>
        </header>

        {/* Código de invitación: respaldo manual si la detección automática falla */}
        {Boolean(token && code) && (
          <div className="il-code">
            <span className="il-code__label">Tu código de invitación</span>
            <div className="il-code__row">
              <code className="il-code__value" id="invite-code">{code}</code>
              <button
                type="button"
                id="copy-code-btn"
                className="il-btn il-btn--ghost il-btn--icon"
                onClick={handleCopyCode}
                aria-label="Copiar código de invitación"
              >
                {codeCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </button>
            </div>
            <span className="il-code__hint">Guárdalo: lo necesitarás si la app te lo pide.</span>
          </div>
        )}

        <ol className="il-steps">
          <Step number={1} icon={Download} title="Descarga la app" active={!downloadStarted}>
            <p className="il-text">
              Toca el botón. Se descargará un archivo que termina en <strong>.apk</strong> (así se
              instalan las apps que aún no están en Play Store).
            </p>
            <a
              id="download-apk-btn"
              href={isDownloading ? undefined : DOWNLOAD_APK_LINK}
              onClick={handleDownload}
              className={`il-btn il-btn--primary ${isDownloading ? 'il-btn--disabled' : ''}`}
            >
              <Download aria-hidden="true" />
              {isDownloading
                ? 'Iniciando descarga...'
                : envConfig.isQA
                ? 'Descargar MutualFam (QA)'
                : 'Descargar MutualFam'}
            </a>
            <p className="il-note">
              Si Chrome dice <em>"Este tipo de archivo puede dañar tu dispositivo"</em>, toca{' '}
              <strong>Descargar de todas formas</strong>.
            </p>

            <details className="il-help">
              <summary>
                <span>¿La descarga se queda al 100% o no finaliza?</span>
                <ChevronDown className="il-help__chevron" aria-hidden="true" />
              </summary>
              <div className="il-help__content">
                <p className="il-help__title">Si el círculo de descarga se completó pero nunca termina:</p>
                <ol className="il-help__list">
                  <li>En Chrome, toca los <strong>tres puntos (⋮)</strong> arriba a la derecha y entra a <strong>Descargas</strong>.</li>
                  <li>Si ves el archivo con advertencia, toca <strong>Mantener</strong> o <strong>Descargar de todas formas</strong>.</li>
                  <li>O abre la app <strong>Archivos / Mis archivos</strong> de tu teléfono en la carpeta <strong>Descargas</strong> para tocar el instalador directamente.</li>
                </ol>
              </div>
            </details>
          </Step>

          <Step number={2} icon={ShieldCheck} title="Instálala" active={downloadStarted}>
            <p className="il-text">
              Cuando termine la descarga, toca la notificación <strong>"Descarga completa"</strong>. Si
              no la ves, abre la app <strong>Archivos</strong> → <strong>Descargas</strong> y toca el
              archivo de MutualFam.
            </p>

            <details className="il-help">
              <summary>
                <span>¿Android no te deja instalar?</span>
                <ChevronDown className="il-help__chevron" aria-hidden="true" />
              </summary>
              <div className="il-help__content">
                <p className="il-help__title">Si dice "Por tu seguridad, no se pueden instalar apps desconocidas":</p>
                <ol className="il-help__list">
                  <li>Toca <strong>Configuración</strong>.</li>
                  <li>Activa <strong>Permitir de esta fuente</strong>.</li>
                  <li>Toca la flecha <strong>atrás</strong> y luego <strong>Instalar</strong>.</li>
                </ol>
                <p className="il-help__title">Si aparece Google Play Protect ("App desconocida"):</p>
                <ol className="il-help__list">
                  <li>Toca <strong>Más detalles</strong>.</li>
                  <li>Toca <strong>Instalar de todas formas</strong>.</li>
                </ol>
                <p className="il-help__foot">
                  Es normal: aparece porque la app todavía no se distribuye por Play Store.
                </p>
              </div>
            </details>
          </Step>

          <Step number={3} icon={UserPlus} title="Abre la app y crea tu cuenta">
            <p className="il-text">
              Al terminar la instalación toca <strong>Abrir</strong> y luego <strong>Regístrate</strong> con
              tu nombre, correo y una contraseña.
            </p>
            {Boolean(token) && (
              <p className="il-note il-note--success">
                La app detectará tu invitación automáticamente{orgName ? ` a ${orgName}` : ''}.
              </p>
            )}
          </Step>

          <Step number={4} icon={Users} title={token ? "Únete a la mutual" : "Únete o crea tu mutual"}>
            <p className="il-text">
              {token ? (
                <>Verás el mensaje <em>"Has sido invitado a…"</em>. Toca <strong>Confirmar y Unirme</strong>.</>
              ) : (
                'Dentro de la app podrás crear una nueva mutual familiar o ingresar el código de invitación que te hayan compartido.'
              )}
            </p>
            {Boolean(token && code) && (
              <p className="il-note">
                ¿No apareció? En la app toca <strong>Tengo un código de invitación</strong> y escribe{' '}
                <code className="il-inline-code">{code}</code>.
              </p>
            )}
          </Step>
        </ol>

        <div className="il-divider">
          <span>¿Ya tienes la app instalada?</span>
        </div>

        <a id="open-app-btn" href={deepLink} className="il-btn il-btn--secondary">
          <Smartphone aria-hidden="true" />
          Abrir invitación en la app
          <ExternalLink className="il-btn__trailing" aria-hidden="true" />
        </a>
      </section>

      <p className="il-footer">Plataforma Cívica Mutual Familiar</p>

      <div className={`il-toast ${toast ? 'il-toast--visible' : ''}`} role="status" aria-live="polite">
        <Check aria-hidden="true" /> {toast}
      </div>
    </main>
  );
}
