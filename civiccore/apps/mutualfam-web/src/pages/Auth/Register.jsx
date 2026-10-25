import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore, membershipApi } from '@civiccore/sdk';
import { UserPlus, Mail, Lock, User, FileText, CheckCircle2 } from 'lucide-react';
import { EnvBadge } from '../../components/Common/EnvBadge';
import { getEnvironmentConfig } from '../../utils/env';

const Register = () => {
  const { register, isAuthenticated } = useAuthStore();
  const envConfig = getEnvironmentConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenParam = searchParams.get('token');
  const inviteToken = tokenParam || (() => {
    try { return localStorage.getItem('pending_join_token'); } catch (_) { return null; }
  })();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (isAuthenticated && !isLoading && !successInfo) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, successInfo, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      const fullName = `${formData.nombre.trim()} ${formData.apellido.trim()}`.trim();
      await register({
        full_name: fullName,
        first_name: formData.nombre.trim(),
        last_name: formData.apellido.trim(),
        identifier: formData.cedula.trim(),
        email: formData.email.trim(),
        password: formData.password
      });

      if (inviteToken) {
        try {
          const joinRes = await membershipApi.joinOrganization(inviteToken);
          try {
            localStorage.removeItem('pending_join_token');
            if (joinRes?.organization_id) {
              localStorage.setItem('organizationId', String(joinRes.organization_id));
              localStorage.setItem('active_org_id', String(joinRes.organization_id));
            }
          } catch (_) {}
          setSuccessInfo("¡Cuenta creada y unido a tu mutual exitosamente!");
        } catch (joinErr) {
          console.warn("Auto-join error:", joinErr);
          setSuccessInfo("¡Cuenta creada exitosamente!");
        }
      } else {
        setSuccessInfo("¡Cuenta creada exitosamente!");
      }

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err?.message || "Error al crear la cuenta");
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card animate-slide-up" style={{ maxWidth: '460px', padding: '1.25rem 1.15rem' }}>
        {/* Encabezado ultra compacto para mobile */}
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserPlus color="white" size={16} />
            </div>
            <h2 className="text-gradient" style={{ fontSize: '1.35rem', margin: 0 }}>MutualFam</h2>
            <EnvBadge size="small" />
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
            {envConfig.tagline || 'Crea tu cuenta y únete a la mutual'}
          </p>
        </div>

        {!envConfig.isProd && (
          <div style={{
            backgroundColor: envConfig.bgColor,
            border: `1px solid ${envConfig.borderColor}`,
            color: envConfig.color,
            borderRadius: '6px',
            padding: '0.35rem 0.6rem',
            fontSize: '0.72rem',
            marginBottom: '0.75rem',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.25,
          }}>
            {envConfig.bannerText}
          </div>
        )}

        {inviteToken && (
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.75rem',
            marginBottom: '0.75rem',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.3,
          }}>
            ✨ Invitación activa: al registrarte entrarás directo a tu mutual.
          </div>
        )}

        {successInfo && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="badge badge-success w-full justify-center" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              <CheckCircle2 size={16} />
              {successInfo}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="badge badge-orange w-full justify-center" style={{ padding: '0.6rem', fontSize: '0.8rem', textTransform: 'none' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2" style={{ marginBottom: '0.65rem' }}>
            <div className="flex-1">
              <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Nombre</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
                <input 
                  type="text" 
                  name="nombre"
                  className="form-input" 
                  style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  required
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Apellido</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
                <input 
                  type="text" 
                  name="apellido"
                  className="form-input" 
                  style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Tu apellido"
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '0.65rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Cédula de Identidad</label>
            <div style={{ position: 'relative' }}>
              <FileText className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
              <input 
                type="text" 
                name="cedula"
                className="form-input" 
                style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                value={formData.cedula}
                onChange={handleChange}
                placeholder="Ej. V12345678"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.65rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
              <input 
                type="email" 
                name="email"
                className="form-input" 
                style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                value={formData.email}
                onChange={handleChange}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
          </div>

          <div className="flex gap-2" style={{ marginBottom: '0.9rem' }}>
            <div className="flex-1">
              <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
                <input 
                  type="password" 
                  name="password"
                  className="form-input" 
                  style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mín. 6 car."
                  required
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Confirmar</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={15} style={{ position: 'absolute', top: '10px', left: '10px' }} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  className="form-input" 
                  style={{ padding: '0.55rem 0.5rem 0.55rem 2rem', fontSize: '16px' }}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repite pass"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            id="register-submit-btn"
            className="btn btn-primary w-full" 
            style={{ 
              padding: '0.85rem 1rem', 
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.45)',
              cursor: 'pointer'
            }}
            disabled={isLoading || Boolean(successInfo)}
          >
            <UserPlus size={18} />
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '0.85rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.82rem', margin: 0 }}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
