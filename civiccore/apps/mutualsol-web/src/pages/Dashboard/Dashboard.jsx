import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, membershipApi } from '@civiccore/sdk';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await membershipApi.stats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load membership stats", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-title">Bienvenido de vuelta, {user?.nombre}</h1>
          <p className="text-secondary">Aquí tienes el resumen actual de la mutual.</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline">
            + Aportar
          </button>
          <button 
            className="btn btn-primary bg-accent hover:bg-orange-500"
            onClick={() => navigate('/credits', { state: { openForm: true } })}
          >
            ↗️ Solicitar Crédito
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* KPI Cards */}
        <div className="glass-card stat-card">
          <div className="stat-header">
            <h3 className="stat-title">Miembros Totales</h3>
            <div className="stat-icon-wrapper bg-blue">
              <Users size={20} className="text-blue" />
            </div>
          </div>
          <div className="stat-value">
            {isLoading ? '...' : stats?.total_members || 0}
          </div>
          <p className="stat-footer text-muted">
            <span className="text-success flex items-center gap-2">
              <TrendingUp size={14} /> +2 este mes
            </span>
          </p>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <h3 className="stat-title">Puntos de Voto Disponibles</h3>
            <div className="stat-icon-wrapper bg-orange">
              <AlertTriangle size={20} className="text-orange" />
            </div>
          </div>
          <div className="stat-value">
            {user?.extra_fields?.puntos_voto_disponibles || 0}
          </div>
          <p className="stat-footer text-muted">Se renuevan en 15 días</p>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <h3 className="stat-title">Referendos Activos</h3>
            <div className="stat-icon-wrapper bg-green">
              <TrendingUp size={20} className="text-green" />
            </div>
          </div>
          <div className="stat-value">3</div>
          <p className="stat-footer text-muted">Requieren tu atención</p>
        </div>
      </div>

      <div className="dashboard-charts mt-8">
        <div className="glass-panel" style={{ padding: '2rem', minHeight: '300px' }}>
          <h3>Actividad Reciente</h3>
          <div className="flex items-center justify-center h-full text-muted mt-8">
            Aquí integraremos un gráfico interactivo con Recharts para visualizar las finanzas y la actividad de referendos.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
