import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import { LogIn, Mail, Lock } from 'lucide-react';

const Login = () => {
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@mutualsol.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      // login success will trigger isAuthenticated -> navigate('/')
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card animate-slide-up">
        <div className="auth-logo">
          <div className="auth-logo-icon flex items-center justify-center">
            <LogIn color="white" size={28} />
          </div>
          <h2 className="text-gradient">MutualSol</h2>
          <p className="text-muted">Acceso a la Gobernanza Central</p>
        </div>

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
