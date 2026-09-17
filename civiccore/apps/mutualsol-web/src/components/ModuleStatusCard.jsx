import React from 'react';
import { useManifest, FRAMEWORK_MATURITY, MODULE_MATURITY } from '@civiccore/sdk';
import { ShieldCheck, TestTube, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

const LEVEL_COLORS = {
  0: 'bg-gray-100 text-gray-500 border-gray-200',
  1: 'bg-red-500/10 text-red-500 border-red-500/20',
  2: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  3: 'bg-green-500/10 text-green-500 border-green-500/20',
  4: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
};

const LEVEL_ICONS = {
  0: AlertCircle,
  1: TestTube,
  2: AlertCircle,
  3: CheckCircle2,
  4: ShieldCheck
};

const MODULE_NAMES = {
  auth: 'Autenticación',
  membership: 'Membresía',
  governance: 'Gobernanza / Asamblea',
  delegates: 'Delegación Líquida',
  board: 'Junta Directiva',
  transparency: 'Transparencia',
  payments: 'Pagos y Tesorería',
  fusion: 'Fusión de Mutuales',
  credits: 'Créditos',
  mercado: 'Mercado Solidario'
};

const ModuleStatusCard = () => {
  const manifest = useManifest();
  const m = manifest?.modules || {};
  const appMaturity = manifest?.appMaturity;
  
  // Filtrar los modulos activos para esta instancia
  const activeModules = Object.entries(MODULE_MATURITY)
    .filter(([key]) => m[key] !== false)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  if (Object.keys(activeModules).length === 0) {
    return null;
  }

  return (
    <div className="glass-card p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="text-primary" size={24} />
          <div>
            <h2 className="text-xl font-bold">Estado del Sistema</h2>
            <p className="text-secondary text-sm">Nivel de madurez de los módulos activos en {manifest?.name || 'CivicCore'}</p>
          </div>
        </div>
        
        {/* Framework Global Maturity */}
        <div className="flex flex-col gap-2">
          {appMaturity && (
            <div className="flex justify-between items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
              <span className="text-sm font-bold">App ({manifest.shortName}) v{appMaturity.version}:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold border ${LEVEL_COLORS[appMaturity.level]}`}>
                {appMaturity.label} (MRL {appMaturity.level})
              </span>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
            <span className="text-sm font-bold">CivicCore v{FRAMEWORK_MATURITY.version}:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${LEVEL_COLORS[FRAMEWORK_MATURITY.level]}`}>
              {FRAMEWORK_MATURITY.label} (MRL {FRAMEWORK_MATURITY.level})
            </span>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {Object.entries(activeModules).map(([key, data]) => {
          const Icon = LEVEL_ICONS[data.level] || AlertCircle;
          return (
            <div key={key} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-lg bg-white/5 border border-white/10 gap-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${LEVEL_COLORS[data.level] || LEVEL_COLORS[0]}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{MODULE_NAMES[key] || key}</h3>
                  <p className="text-xs text-secondary">Desde {data.since || 'Inicio'}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${LEVEL_COLORS[data.level] || LEVEL_COLORS[0]}`}>
                {data.label} (MRL {data.level})
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20 text-xs text-secondary">
        <strong>MRL (Module Readiness Level):</strong> Escala de 0 a 4 que indica la fiabilidad de un módulo basada en su tiempo en producción y adopción por organizaciones reales.
      </div>
    </div>
  );
};

export default ModuleStatusCard;
