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
    // Solo redirigir si ya estaba autenticado al entrar (no durante el registro activo)
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

      // Si existe un token de invitación, auto-unir a la mutual
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
          // Si falló el join (por ej. token vencido), la cuenta igual fue creada
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
      <div className="glass-card auth-card animate-slide-up" style={{ maxWidth: '480px' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon flex items-center justify-center">
            <UserPlus color="white" size={24} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.5rem' }}>MutualFam</h2>
            <EnvBadge size="small" />
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center' }}>
            {envConfig.tagline || 'Crea tu cuenta y únete a la mutual familiar'}
          </p>
        </div>

        {!envConfig.isProd && (
          <div style={{
            backgroundColor: envConfig.bgColor,
            border: `1px solid ${envConfig.borderColor}`,
            color: envConfig.color,
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.78rem',
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.35,
          }}>
            {envConfig.bannerText}
          </div>
        )}

        {inviteToken && (
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: 'var(--radius-md)',
            padding: '0.55rem 0.8rem',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            ✨ Invitación detectada: al registrarte te uniremos automáticamente a tu mutual familiar.
          </div>
        )}

        {successInfo && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div className="badge badge-success w-full justify-center" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} />
              {successInfo}
            </div>
          </div>
        )}

        {error && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div className="badge badge-orange w-full justify-center" style={{ padding: '0.75rem', fontSize: '0.85rem', textTransform: 'none' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-3" style={{ marginBottom: '0.85rem' }}>
            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Nombre</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
                <input 
                  type="text" 
                  name="nombre"
                  className="form-input" 
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', fontSize: '16px' }}
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Apellido</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
                <input 
                  type="text" 
                  name="apellido"
                  className="form-input" 
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', fontSize: '16px' }}
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Tu apellido"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Cédula de Identidad</label>
            <div style={{ position: 'relative' }}>
              <FileText className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
              <input 
                type="text" 
                name="cedula"
                className="form-input" 
                style={{ paddingLeft: '2.2rem', fontSize: '16px' }}
                value={formData.cedula}
                onChange={handleChange}
                placeholder="Ej. V12345678"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
              <input 
                type="email" 
                name="email"
                className="form-input" 
                style={{ paddingLeft: '2.2rem', fontSize: '16px' }}
                value={formData.email}
                onChange={handleChange}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
          </div>

          <div className="flex gap-3" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
                <input 
                  type="password" 
                  name="password"
                  className="form-input" 
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', fontSize: '16px' }}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 car."
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Confirmar</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={16} style={{ position: 'absolute', top: '12px', left: '10px' }} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  className="form-input" 
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.5rem', fontSize: '16px' }}
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
              boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
            }}
            disabled={isLoading || Boolean(successInfo)}
          >
            <UserPlus size={18} />
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '1.25rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
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
