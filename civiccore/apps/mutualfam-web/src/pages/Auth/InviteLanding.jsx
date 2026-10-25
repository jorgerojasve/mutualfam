import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  Smartphone,
  Globe,
  Copy,
  Check,
  ShieldCheck,
  UserPlus,
  Users,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import './InviteLanding.css';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';

const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
  .toString()
  .trim()
  .replace(/[\r\n\t]/g, '')
  .replace(/\/+$/, '');
const API_URL = rawApiUrl || 'https://mutualfam-backend.fly.dev/api/v1';

// Enlace Mágico: el backend siempre redirige a la última versión del APK
// publicada en GitHub, sin que tengamos que actualizar esta página web.
const DOWNLOAD_APK_LINK = `${API_URL}/config/latest-apk`;

function detectInitialPlatform() {
  if (typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent || '';
  const plat = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints || 0;
  if (/iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && maxTouch > 1)) {
    return 'ios';
  }
  return 'android';
}

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="il-google-icon" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function FirebaseModal({ isOpen, onClose, onDownloadDirect, inviteUrl, playStoreUrl }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="il-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="il-modal" onClick={(e) => e.stopPropagation()}>
        <div className="il-modal__header">
          <h3 className="il-modal__title">Asistente Google / Firebase</h3>
          <button
            type="button"
            className="il-modal__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="il-modal__body">
          <p>
            El instalador de Google Firebase permite descargar la app viendo el progreso exacto de 0% a 100% y previene que teléfonos Xiaomi o Redmi intenten abrir el archivo con visores de documentos.
          </p>

          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '0.625rem', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <strong>💡 Estado del enlace:</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#93c5fd' }}>
              {inviteUrl
                ? 'El enlace oficial de testers está listo. Puedes abrirlo ahora.'
                : 'El enlace de invitación para el grupo de testers se está activando en el servidor.'}
            </p>
          </div>

          <p style={{ fontSize: '0.825rem' }}>
            Si deseas instalarla de inmediato sin esperar la invitación de Google, puedes usar la <strong>Descarga Directa de APK</strong> disponible ahora mismo.
          </p>
        </div>

        <div className="il-modal__footer">
          {inviteUrl ? (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="il-btn il-btn--primary"
              onClick={onClose}
            >
              <ExternalLink size={16} /> Abrir Invitación en Firebase
            </a>
          ) : (
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="il-btn il-btn--secondary"
            >
              <ExternalLink size={16} /> Ver App Tester en Google Play
            </a>
          )}
          <button
            type="button"
            className="il-btn il-btn--primary"
            onClick={() => {
              onClose();
              onDownloadDirect();
            }}
          >
            <Download size={16} /> Descargar APK directamente ahora
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [selectedPlatform, setSelectedPlatform] = useState(detectInitialPlatform);
  const [firebaseConfig, setFirebaseConfig] = useState({
    url: import.meta.env.VITE_FIREBASE_INVITE_URL || '',
    app_id: '',
    has_custom_url: Boolean(import.meta.env.VITE_FIREBASE_INVITE_URL),
    app_tester_playstore: 'https://play.google.com/store/apps/details?id=com.google.android.apps.internal.betterbug',
  });
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [googleDeviceInfo, setGoogleDeviceInfo] = useState({ isAndroid: false, hasGoogleLikelihood: false });
  const downloadCooldownRef = useRef(false);
  const toastTimer = useRef(null);
  const envConfig = getEnvironmentConfig();

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isChrome = /Chrome|CriOS/i.test(ua) && !/Edge|OPR/i.test(ua);
      setGoogleDeviceInfo({
        isAndroid,
        hasGoogleLikelihood: isAndroid && (isChrome || /Mobile/i.test(ua)),
      });
    }

    const queryFirebaseUrl = searchParams.get('firebase_url');
    if (queryFirebaseUrl) {
      setFirebaseConfig((prev) => ({
        ...prev,
        url: queryFirebaseUrl,
        has_custom_url: true,
      }));
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/config/firebase-tester-url`)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data && data.url) {
          setFirebaseConfig((prev) => ({
            ...prev,
            url: data.url,
            app_id: data.app_id || prev.app_id,
            has_custom_url: Boolean(data.url),
            app_tester_playstore: data.app_tester_playstore || prev.app_tester_playstore,
          }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (token) {
      document.title = envConfig.isQA
        ? 'Invitación a Mutual Familiar (QA) | MutualFam'
        : 'Invitación a Mutual Familiar | MutualFam';
    } else {
      document.title = envConfig.isQA
        ? 'Acceso a MutualFam (QA) - Android e iPhone'
        : 'Acceso a MutualFam - Android e iPhone';
    }
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Accede a la app oficial de Mutual Familiar para Android e iPhone y gestiona préstamos y aportes familiares.'
      );
    }
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

  const handleFirebaseClick = () => {
    if (token) {
      copyText(window.location.href);
    }

    if (firebaseConfig.has_custom_url && firebaseConfig.url) {
      showToast('Abriendo Asistente Google / Firebase...');
      window.open(firebaseConfig.url, '_blank', 'noopener,noreferrer');
      setDownloadStarted(true);
    } else {
      setShowFirebaseModal(true);
    }
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
            Esta invitación ya expiró o no corresponde a este entorno de pruebas. Pide a quien te invitó que te envíe una nueva.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%', marginTop: '1.25rem' }}>
            <a href="/login" className="il-btn il-btn--primary">
              Iniciar Sesión en MutualFam
            </a>
            <a href="/register" className="il-btn il-btn--secondary">
              Crear una cuenta nueva
            </a>
            <a href="/invite" className="il-btn il-btn--ghost" style={{ fontSize: '0.85rem' }}>
              Ver opciones de acceso general
            </a>
          </div>
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
          <p className="il-eyebrow">
            {token
              ? 'Tienes una invitación'
              : selectedPlatform === 'ios'
              ? 'Acceso Oficial para iPhone'
              : 'Aplicación Oficial Android'}
          </p>
          <h1 className="il-title">
            {status === 'loading' ? (
              <span className="il-skeleton" />
            ) : orgName ? (
              <>Te invitaron a <span className="il-gradient">{orgName}</span></>
            ) : token ? (
              <>Te invitaron a una <span className="il-gradient">Mutual Familiar</span></>
            ) : (
              <>Accede a <span className="il-gradient">{envConfig.appName}</span></>
            )}
          </h1>
          <p className="il-lead">
            {selectedPlatform === 'ios'
              ? 'Sigue estos sencillos pasos para usar la aplicación directamente en tu iPhone.'
              : token
              ? 'Sigue estos 4 pasos. Te tomará unos 3 minutos.'
              : 'Sigue estos sencillos pasos para instalar la aplicación en tu dispositivo móvil.'}
          </p>
        </header>

        {/* Selector de plataforma Android vs iPhone */}
        <div className="il-tabs" role="tablist" aria-label="Seleccionar plataforma">
          <button
            type="button"
            role="tab"
            aria-selected={selectedPlatform === 'android'}
            className={`il-tab ${selectedPlatform === 'android' ? 'il-tab--active' : ''}`}
            onClick={() => setSelectedPlatform('android')}
          >
            <Smartphone size={16} aria-hidden="true" />
            <span>🤖 Android (APK)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedPlatform === 'ios'}
            className={`il-tab ${selectedPlatform === 'ios' ? 'il-tab--active' : ''}`}
            onClick={() => setSelectedPlatform('ios')}
          >
            <Globe size={16} aria-hidden="true" />
            <span>🍏 iPhone (Web App)</span>
          </button>
        </div>

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

        {/* Pasos para iPhone */}
        {selectedPlatform === 'ios' ? (
          <ol className="il-steps">
            <Step number={1} icon={Globe} title="Entra a la aplicación" active={true}>
              <p className="il-text">
                En iPhone no necesitas descargar archivos APK. Accede directamente a la versión oficial optimizada para Safari:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <a
                  id="enter-web-btn"
                  href={token ? `/register?token=${encodeURIComponent(token)}` : '/login'}
                  onClick={() => {
                    if (token) {
                      try { localStorage.setItem('pending_join_token', token); } catch (_) {}
                      copyText(window.location.href);
                    }
                  }}
                  className="il-btn il-btn--primary"
                >
                  <UserPlus aria-hidden="true" />
                  {token ? 'Entrar y Registrarme' : 'Abrir MutualFam Web'}
                </a>
                <a
                  href="/login"
                  className="il-btn il-btn--ghost"
                  style={{ fontSize: '0.85rem' }}
                >
                  ¿Ya tienes cuenta? Inicia sesión aquí
                </a>
              </div>
            </Step>

            <Step number={2} icon={ShieldCheck} title="Agrégala a tu pantalla de inicio" active={false}>
              <p className="il-text">
                Para usarla con su ícono oficial en tu escritorio y que abra a pantalla completa sin barras de navegador:
              </p>
              <div className="il-ios-guide">
                <div className="il-ios-guide__step">
                  <span className="il-ios-guide__num">1</span>
                  <span>En Safari, toca el botón <strong>Compartir</strong> (el ícono de la cajita con flecha <strong>⎋</strong> en la barra inferior).</span>
                </div>
                <div className="il-ios-guide__step">
                  <span className="il-ios-guide__num">2</span>
                  <span>Desliza hacia abajo en el menú y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</span>
                </div>
                <div className="il-ios-guide__step">
                  <span className="il-ios-guide__num">3</span>
                  <span>Toca <strong>"Agregar"</strong> arriba a la derecha.</span>
                </div>
              </div>
              <p className="il-note il-note--success">
                ✨ ¡Listo! Se creará el ícono oficial de MutualFam en tu iPhone y abrirá como una aplicación instalada.
              </p>
            </Step>

            <Step number={3} icon={UserPlus} title="Crea tu cuenta o inicia sesión" active={false}>
              <p className="il-text">
                Regístrate con tu nombre, correo y contraseña para activar tu acceso personal.
              </p>
              {Boolean(token) && (
                <p className="il-note il-note--success">
                  La app detectará tu invitación automáticamente{orgName ? ` a ${orgName}` : ''}.
                </p>
              )}
            </Step>

            <Step number={4} icon={Users} title={token ? "Únete a la mutual" : "Únete o crea tu mutual"} active={false}>
              <p className="il-text">
                {token ? (
                  <>Verás el mensaje <em>"Has sido invitado a…"</em>. Toca <strong>Confirmar y Unirme</strong>.</>
                ) : (
                  'Dentro de la app podrás crear una nueva mutual familiar o ingresar el código de invitación que te hayan compartido.'
                )}
              </p>
              {Boolean(token && code) && (
                <p className="il-note">
                  ¿No apareció automáticamente? Copia tu código: <code className="il-inline-code">{code}</code>.
                </p>
              )}
            </Step>
          </ol>
        ) : (
          /* Pasos para Android */
          <ol className="il-steps">
            <Step number={1} icon={Download} title="Descarga la app en tu teléfono" active={!downloadStarted}>
              <p className="il-text">
                Elige cómo prefieres instalar MutualFam en tu teléfono Android:
              </p>

              {googleDeviceInfo.hasGoogleLikelihood && (
                <div className="il-google-detect-banner">
                  <Sparkles size={16} aria-hidden="true" />
                  <span>
                    Dispositivo Android detectado con compatibilidad de cuenta Google.
                  </span>
                </div>
              )}

              <div className="il-methods-container">
                {/* Camino A: Asistente Google / Firebase (Recomendado) */}
                <div className="il-method-card il-method-card--featured">
                  <div className="il-method-header">
                    <span className="il-method-tag">⭐ Recomendado</span>
                    <span className="il-method-badge-google">
                      <GoogleIcon />
                      Con cuenta Google
                    </span>
                  </div>

                  <h3 className="il-method-title">Instalar con Asistente Google / Firebase</h3>
                  <p className="il-method-desc">
                    Recomendado para evitar fallas comunes en teléfonos Xiaomi, Redmi y Samsung:
                  </p>

                  <div className="il-features-list">
                    <div className="il-feature-item">
                      <span className="il-feature-check">✓</span>
                      <span><strong>Progreso en tiempo real:</strong> Muestra el porcentaje de descarga (0% a 100%) en vivo.</span>
                    </div>
                    <div className="il-feature-item">
                      <span className="il-feature-check">✓</span>
                      <span><strong>Cero errores Xiaomi/Redmi:</strong> Lanza directo el instalador de Android evitando visores de WPS Office o Drive.</span>
                    </div>
                    <div className="il-feature-item">
                      <span className="il-feature-check">✓</span>
                      <span><strong>Actualizaciones automáticas:</strong> Te notifica cada vez que publiquemos una nueva versión.</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="firebase-download-btn"
                    className="il-btn il-btn--primary il-btn--firebase"
                    onClick={handleFirebaseClick}
                  >
                    <ExternalLink aria-hidden="true" />
                    <span>Instalar vía Asistente Google</span>
                  </button>
                </div>

                {/* Divisor de opciones */}
                <div className="il-option-divider">
                  <span>O si prefieres instalar manualmente</span>
                </div>

                {/* Camino B: Descarga directa de APK */}
                <div className="il-method-card il-method-card--direct">
                  <div className="il-method-header">
                    <span className="il-method-tag il-method-tag--neutral">
                      📦 Archivo directo (~87 MB)
                    </span>
                  </div>

                  <h3 className="il-method-title">Descarga directa de archivo APK</h3>
                  <p className="il-method-desc">
                    Descarga el archivo instalador directamente a tu teléfono sin pasar por Google:
                  </p>

                  <a
                    id="download-apk-btn"
                    href={DOWNLOAD_APK_LINK}
                    download
                    onClick={handleDownload}
                    className={`il-btn il-btn--secondary ${isDownloading ? 'il-btn--disabled' : ''}`}
                  >
                    <Download aria-hidden="true" />
                    <span>{isDownloading ? 'Iniciando descarga directa...' : 'Descargar archivo APK directo'}</span>
                  </a>

                  {downloadStarted && (
                    <div className="il-download-status">
                      <div className="il-status-indicator">
                        <span className="il-spinner-pulse" />
                        <span>Descarga iniciada. Revisa la barra de notificaciones superior de tu teléfono.</span>
                      </div>
                    </div>
                  )}

                  <div className="il-xiaomi-notice">
                    <AlertTriangle className="il-xiaomi-notice__icon" size={16} aria-hidden="true" />
                    <div className="il-xiaomi-notice__text">
                      <strong>¿Tu teléfono abre WPS Office, Drive o dice "No se puede abrir el archivo"?</strong>
                      <span>
                        En Xiaomi y Redmi: abre la app <strong>"Archivos"</strong> o <strong>"Administrador de archivos"</strong> de tu teléfono, ve a <strong>Descargas</strong>, toca el archivo APK y elige <strong>Instalador de paquetes</strong>.
                      </span>
                    </div>
                  </div>

                  <details className="il-help">
                    <summary>
                      <span>¿La descarga no avanza o se queda pegada?</span>
                      <ChevronDown className="il-help__chevron" aria-hidden="true" />
                    </summary>
                    <div className="il-help__content">
                      <p className="il-help__title">Consejos si Chrome no muestra el avance:</p>
                      <ol className="il-help__list">
                        <li>En Chrome, toca los <strong>tres puntos (⋮)</strong> arriba a la derecha y entra a <strong>Descargas</strong>.</li>
                        <li>Si ves el archivo con advertencia, toca <strong>Mantener</strong> o <strong>Descargar de todas formas</strong>.</li>
                        <li>Si persiste, te recomendamos usar arriba la opción <strong>"Instalar con Asistente Google / Firebase"</strong> que muestra el porcentaje en vivo.</li>
                      </ol>
                    </div>
                  </details>
                </div>
              </div>
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
        )}

        <div className="il-divider">
          <span>{selectedPlatform === 'ios' ? '¿Ya tienes cuenta en la web?' : '¿Ya tienes la app instalada?'}</span>
        </div>

        {selectedPlatform === 'ios' ? (
          <a id="open-app-btn" href="/login" className="il-btn il-btn--secondary">
            <Globe aria-hidden="true" />
            Ir a Iniciar Sesión en la Web
            <ExternalLink className="il-btn__trailing" aria-hidden="true" />
          </a>
        ) : (
          <a id="open-app-btn" href={deepLink} className="il-btn il-btn--secondary">
            <Smartphone aria-hidden="true" />
            Abrir invitación en la app
            <ExternalLink className="il-btn__trailing" aria-hidden="true" />
          </a>
        )}
      </section>

      <p className="il-footer">Plataforma Cívica Mutual Familiar</p>

      <div className={`il-toast ${toast ? 'il-toast--visible' : ''}`} role="status" aria-live="polite">
        <Check aria-hidden="true" /> {toast}
      </div>

      <FirebaseModal
        isOpen={showFirebaseModal}
        onClose={() => setShowFirebaseModal(false)}
        onDownloadDirect={() => {
          const btn = document.getElementById('download-apk-btn');
          if (btn) btn.click();
          else handleDownload();
        }}
        inviteUrl={firebaseConfig.url}
        playStoreUrl={firebaseConfig.app_tester_playstore}
      />
    </main>
  );
}
