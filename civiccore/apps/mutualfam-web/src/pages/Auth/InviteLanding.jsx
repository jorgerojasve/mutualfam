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
  const [status, setStatus] = useState('loading'); // loading | ok | invalid | offline
  const [toast, setToast] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    document.title = 'Invitación a Mutual Familiar | MutualFam';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Acepta tu invitación a una Mutual Familiar: descarga la app, crea tu cuenta y únete en minutos.');
  }, []);

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
  const deepLink = `mutualfam://join/${invite?.token || token}`;

  const handleCopyCode = async () => {
    if (await copyText(code)) {
      setCodeCopied(true);
      showToast('Código copiado');
      window.setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    // Capa "portapapeles": copiamos el enlace de invitación para que la app
    // lo detecte automáticamente al abrirse por primera vez tras instalarla.
    copyText(window.location.href);
    setDownloadStarted(true);
  };

  if (!token || status === 'invalid') {
    return (
      <main className="il-page">
        <div className="il-bg" aria-hidden="true" />
        <section className="il-card il-card--center">
          <div className="il-badge il-badge--danger">
            <AlertTriangle aria-hidden="true" />
          </div>
          <h1 className="il-title">{token ? 'Invitación no válida' : 'Enlace inválido'}</h1>
          <p className="il-lead">
            {token
              ? 'Esta invitación ya expiró o fue revocada. Pide a quien te invitó que te envíe una nueva.'
              : 'El enlace de invitación no contiene un código válido.'}
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
        <header className="il-header">
          <div className="il-badge">
            <Users aria-hidden="true" />
          </div>
          <p className="il-eyebrow">Tienes una invitación</p>
          <h1 className="il-title">
            {status === 'loading' ? (
              <span className="il-skeleton" />
            ) : orgName ? (
              <>Te invitaron a <span className="il-gradient">{orgName}</span></>
            ) : (
              <>Te invitaron a una <span className="il-gradient">Mutual Familiar</span></>
            )}
          </h1>
          <p className="il-lead">Sigue estos 4 pasos. Te tomará unos 3 minutos.</p>
        </header>

        {/* Código de invitación: respaldo manual si la detección automática falla */}
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

        <ol className="il-steps">
          <Step number={1} icon={Download} title="Descarga la app" active={!downloadStarted}>
            <p className="il-text">
              Toca el botón. Se descargará un archivo que termina en <strong>.apk</strong> (así se
              instalan las apps que aún no están en Play Store).
            </p>
            <a
              id="download-apk-btn"
              href={DOWNLOAD_APK_LINK}
              onClick={handleDownload}
              className="il-btn il-btn--primary"
            >
              <Download aria-hidden="true" />
              Descargar MutualFam
            </a>
            <p className="il-note">
              Si Chrome dice <em>"Este tipo de archivo puede dañar tu dispositivo"</em>, toca{' '}
              <strong>Descargar de todas formas</strong>.
            </p>
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
            <p className="il-note il-note--success">
              La app detectará tu invitación automáticamente{orgName ? ` a ${orgName}` : ''}.
            </p>
          </Step>

          <Step number={4} icon={Users} title="Únete a la mutual">
            <p className="il-text">
              Verás el mensaje <em>"Has sido invitado a…"</em>. Toca <strong>Confirmar y Unirme</strong>.
            </p>
            <p className="il-note">
              ¿No apareció? En la app toca <strong>Tengo un código de invitación</strong> y escribe{' '}
              <code className="il-inline-code">{code}</code>.
            </p>
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
