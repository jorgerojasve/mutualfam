import React, { useEffect, useState } from 'react';
import { Shield, Server, Activity } from 'lucide-react';
import { configApi, useConfigStore } from '@civiccore/sdk';

const Transparency = () => {
  const { terminology } = useConfigStore();
  const [configs, setConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const data = await configApi.getVariables();
        setConfigs(data);
      } catch (error) {
        console.error("Error fetching configs", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchConfigs();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <Shield className="text-accent-primary" size={32} /> {terminology.transparency} y Auditoría
        </h1>
        <p className="text-secondary">Visibilidad total sobre las reglas del sistema inmutables.</p>
      </div>

      <div className="dashboard-grid mb-8">
        <div className="glass-card stat-card border-l-4" style={{ borderLeftColor: 'var(--accent-primary)' }}>
          <div className="flex items-center gap-4 mb-2">
            <Server className="text-blue" size={24} />
            <h3 className="font-medium">Estado del Sistema</h3>
          </div>
          <p className="text-2xl font-bold text-success">Operativo</p>
          <p className="text-xs text-muted mt-2">Última auditoría: Hace 2 horas</p>
        </div>
        
        <div className="glass-card stat-card border-l-4" style={{ borderLeftColor: 'var(--accent-secondary)' }}>
          <div className="flex items-center gap-4 mb-2">
            <Activity className="text-green" size={24} />
            <h3 className="font-medium">Nivel de Descentralización</h3>
          </div>
          <p className="text-2xl font-bold">Fase 2</p>
          <p className="text-xs text-muted mt-2">Voto Cuadrático Habilitado</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 className="mb-6 font-medium">Variables de Gobernanza Actuales</h3>
        
        {isLoading ? (
          <div className="loader">Cargando variables...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Variable / Parámetro</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Valor Actual</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Última Modificación</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(config => (
                  <tr key={config.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                      {config.key}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>
                      {config.value}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {config.updated_at 
                        ? new Date(config.updated_at).toLocaleString() 
                        : (config.created_at 
                            ? new Date(config.created_at).toLocaleString() 
                            : 'Implementación inicial')
                      }
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron variables de configuración.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transparency;
