import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, useManifest, membershipApi } from '@civiccore/sdk';
import { LogIn, Mail, Lock } from 'lucide-react';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';

const Login = () => {
  const { login, isAuthenticated } = useAuthStore();
  const manifest = useManifest();
  const envConfig = getEnvironmentConfig();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const authState = useAuthStore.getState();
      const orgs = authState.organizations || [];
      if (orgs.length === 0) {
        navigate('/select-mutual', { replace: true });
      } else {
        navigate('/loans', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      
      // Auto-join si había una invitación pendiente
      const pendingToken = (() => {
        try { return localStorage.getItem('pending_join_token'); } catch (_) { return null; }
      })();
      if (pendingToken) {
        try {
          const joinRes = await membershipApi.joinOrganization(pendingToken);
          localStorage.removeItem('pending_join_token');
          if (joinRes?.organization_id) {
            localStorage.setItem('organizationId', String(joinRes.organization_id));
            localStorage.setItem('active_org_id', String(joinRes.organization_id));
          }
          navigate('/loans', { replace: true });
          return;
        } catch (joinErr) {
          console.warn("Auto-join post-login error:", joinErr);
        }
      }

      // Comprobar si el usuario tiene mutuales
      const authState = useAuthStore.getState();
      const orgs = authState.organizations || [];
      if (orgs.length === 0) {
        navigate('/select-mutual', { replace: true });
      } else if (orgs.length === 1) {
        navigate('/loans', { replace: true });
      } else {
        const stored = localStorage.getItem('active_org_id');
        navigate(stored ? '/loans' : '/select-mutual', { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card animate-slide-up" style={manifest.coverImage ? { backgroundImage: `url(${manifest.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className="auth-logo">
          <img
            src={envConfig.isQA ? '/logo-qa.png' : '/logo.png'}
            alt="Mutual Familiar"
            style={{ width: '72px', height: '72px', borderRadius: '16px', marginBottom: '12px', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.6rem', margin: 0, fontWeight: 700 }}>Mutual Familiar</h2>
            <EnvBadge size="medium" />
          </div>
          <p className="text-muted" style={{ marginTop: '4px' }}>{envConfig.tagline || 'Acceso a la Plataforma'}</p>
        </div>

        {!envConfig.isProd && (
          <div style={{
            backgroundColor: envConfig.bgColor,
            border: `1px solid ${envConfig.borderColor}`,
            color: envConfig.color,
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.9rem',
            fontSize: '0.8rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            {envConfig.bannerText}
          </div>
        )}

        {error && (
          <div className="form-group">
            <div className="badge badge-orange w-full justify-center" style={{ padding: '0.75rem' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
              <input 
                type="email" 
                className="form-input" 
                style={{ paddingLeft: '2.5rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
              <input 
                type="password" 
                className="form-input" 
                style={{ paddingLeft: '2.5rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full" 
            style={{ marginTop: '1.5rem', padding: '0.75rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '1.5rem' }}>
          <p className="text-secondary">
            ¿No tienes cuenta?{' '}
            <Link to="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
