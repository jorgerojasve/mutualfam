import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import { Settings as SettingsIcon, AlertTriangle, Shield, Bell, Key } from 'lucide-react';

const Settings = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto p-8 space-y-8">
      <div className="page-header mb-8">
        <h1 className="page-title text-2xl font-bold">Configuración de Cuenta</h1>
        <p className="text-secondary">Administra tus preferencias y seguridad.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Menú Lateral de Configuración (Visual) */}
        <div className="col-span-1 space-y-2">
          <button className="w-full text-left p-3 rounded-lg bg-white/10 text-primary font-bold flex items-center gap-3">
            <SettingsIcon size={18} /> General
          </button>
          <button className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-secondary flex items-center gap-3">
            <Shield size={18} /> Privacidad
          </button>
          <button className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-secondary flex items-center gap-3">
            <Bell size={18} /> Notificaciones
          </button>
          <button className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-secondary flex items-center gap-3">
            <Key size={18} /> Seguridad
          </button>
        </div>

        {/* Panel Principal */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          
          <div className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6">Información Personal</h2>
            <div className="space-y-6">
              <div>
                <label className="form-label">Nombre Completo</label>
                <input type="text" className="form-input" disabled value={`${user?.nombre} ${user?.apellido}`} />
              </div>
              <div>
                <label className="form-label">Correo Electrónico</label>
                <input type="email" className="form-input" disabled value={user?.email} />
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-red-500/20 border">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-500" size={20} />
              <h2 className="text-lg font-bold text-red-500">Zona de Peligro</h2>
            </div>
            <p className="text-secondary text-sm mb-4">
              Acciones destructivas o irreversibles relacionadas con tu membresía en la mutual.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-red-500/5 rounded-lg border border-red-500/20">
              <div>
                <h3 className="font-bold mb-1">Salida Voluntaria de la Mutual</h3>
                <p className="text-xs text-secondary max-w-sm">
                  Iniciar el proceso para retirarte de la organización. Implica la pérdida de derechos políticos tras un período de espera.
                </p>
              </div>
              <button 
                className="mt-4 sm:mt-0 btn btn-outline border-red-500 text-red-500 hover:bg-red-500/10 text-sm whitespace-nowrap"
                onClick={() => navigate('/membership/withdrawal')}
              >
                Gestionar Salida
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
