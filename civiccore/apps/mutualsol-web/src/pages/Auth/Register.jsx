import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import { UserPlus, Mail, Lock, User, FileText } from 'lucide-react';

const Register = () => {
  const { register, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

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
      await register({
        first_name: formData.nombre.trim(),
        last_name: formData.apellido.trim(),
        identifier: formData.cedula.trim(),
        email: formData.email.trim(),
        password: formData.password
      });
      // register success will trigger isAuthenticated -> navigate('/')
    } catch (err) {
      setError(err.message || "Error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card animate-slide-up" style={{ maxWidth: '500px' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon flex items-center justify-center">
            <UserPlus color="white" size={28} />
          </div>
          <h2 className="text-gradient">MutualSol</h2>
          <p className="text-muted">Crea tu cuenta y únete a la mutual</p>
        </div>

        {error && (
          <div className="form-group">
            <div className="badge badge-orange w-full justify-center" style={{ padding: '0.75rem' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="form-label">Nombre</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
                <input 
                  type="text" 
                  name="nombre"
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Apellido</label>
              <div style={{ position: 'relative' }}>
                <User className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
                <input 
                  type="text" 
                  name="apellido"
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.apellido}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cédula de Identidad</label>
            <div style={{ position: 'relative' }}>
              <FileText className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
              <input 
                type="text" 
                name="cedula"
                className="form-input" 
                style={{ paddingLeft: '2.5rem' }}
                value={formData.cedula}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
              <input 
                type="email" 
                name="email"
                className="form-input" 
                style={{ paddingLeft: '2.5rem' }}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
                <input 
                  type="password" 
                  name="password"
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Confirmar Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock className="text-muted" size={18} style={{ position: 'absolute', top: '12px', left: '12px' }} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full" 
            style={{ marginTop: '1.5rem', padding: '0.75rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '1.5rem' }}>
          <p className="text-secondary">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
