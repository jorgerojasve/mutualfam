import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, membershipApi, gobernanzaApi } from '@civiccore/sdk';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Ene', aportes: 4000, creditos: 2400 },
  { name: 'Feb', aportes: 3000, creditos: 1398 },
  { name: 'Mar', aportes: 2000, creditos: 9800 },
  { name: 'Abr', aportes: 2780, creditos: 3908 },
  { name: 'May', aportes: 1890, creditos: 4800 },
  { name: 'Jun', aportes: 2390, creditos: 3800 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [activeProposals, setActiveProposals] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [statsData, proposalsData] = await Promise.all([
          membershipApi.stats(),
          gobernanzaApi.listarPropuestas()
        ]);
        setStats(statsData);
        // Filter voting proposals
        const votingCount = proposalsData.filter(p => p.status === 'VOTING').length;
        setActiveProposals(votingCount);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-title">Bienvenido de vuelta, {user?.nombre}</h1>
          <p className="text-secondary">Aquí tienes el resumen actual de la mutual.</p>
        </div>
        <div className="flex gap-4">
          <button 
            className="btn btn-outline border-green-500/50 text-green-400 hover:bg-green-500/10"
            onClick={() => navigate('/payments')}
          >
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
          <div className="stat-value">{isLoading ? '...' : activeProposals}</div>
          <p className="stat-footer text-muted">Requieren tu atención</p>
        </div>
      </div>

      <div className="dashboard-charts mt-8 grid grid-cols-1 gap-8">
        <div className="glass-panel p-6 min-h-[300px]">
          <h3 className="font-bold text-white mb-6">Balance Financiero (Mock)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mockChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff50" />
                <YAxis stroke="#ffffff50" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000000f0', borderColor: '#ffffff20' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="aportes" fill="#4ade80" name="Aportes" radius={[4, 4, 0, 0]} />
                <Bar dataKey="creditos" fill="#f97316" name="Créditos Otorgados" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
