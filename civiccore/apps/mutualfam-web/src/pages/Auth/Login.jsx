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
  const [email, setEmail] = useState('admin@mutualsol.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
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
        } catch (joinErr) {
          console.warn("Auto-join post-login error:", joinErr);
        }
      }

      navigate('/', { replace: true });
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
          {manifest.logo ? (
            <img src={manifest.logo} alt={manifest.shortName} className="auth-logo-img mb-4 mx-auto" style={{ maxHeight: '80px' }} />
          ) : (
            <div className="auth-logo-icon flex items-center justify-center">
              <LogIn color="white" size={28} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
            <h2 className="text-gradient">{manifest.name || 'MutualFam'}</h2>
            <EnvBadge size="medium" />
          </div>
          <p className="text-muted">{envConfig.tagline || manifest.tagline || 'Acceso a la Plataforma'}</p>
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
