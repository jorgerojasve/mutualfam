import React, { useEffect, useState } from 'react';
import { membershipApi } from '@civiccore/sdk';
import { GitBranch, GitMerge, Clock, CheckCircle, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OrganizationEvents = () => {
  const [fusionProcesses, setFusionProcesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [eventsData, fusionData] = await Promise.all([
        membershipApi.obtenerEventosOrganizacion(),
        membershipApi.getFusionProcesses()
      ]);
      setEvents(eventsData);
      setFusionProcesses(fusionData);
    } catch (error) {
      console.error("Error fetching organization events", error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = useNavigate();

  const getEventIcon = (type) => {
    if (type === 'division') return <GitBranch className="text-blue-500" size={24} />;
    if (type === 'fusion') return <GitMerge className="text-yellow-500" size={24} />;
    return <Clock size={24} />;
  };

  const getEventTitle = (type) => {
    if (type === 'division') return 'División Organizacional';
    if (type === 'fusion') return 'Fusión Organizacional';
    return type;
  };

  const getStageLabel = (stage) => {
    const labels = {
      'intention': 'Intención',
      'exploration': 'Exploración',
      'evaluation': 'Evaluación',
      'negotiation': 'Negociación',
      'referendum': 'Referendo',
      'integration': 'Integración',
      'completed': 'Completado',
      'rejected': 'Rechazado'
    };
    return labels[stage] || stage;
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mt-8">
      <div className="page-header mb-8">
        <h1 className="page-title text-2xl font-bold">Eventos de Organización</h1>
        <p className="text-secondary">Historial de procesos de división y fusión mutual.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-8">
          <div className="loader">Cargando...</div>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Fusion Processes (Progressive) */}
          <section>
            <h2 className="text-xl font-bold text-accent mb-4">Procesos de Fusión Progresiva</h2>
            {fusionProcesses.length === 0 ? (
              <p className="text-secondary p-4 glass-card">No hay procesos de fusión progresiva activos.</p>
            ) : (
              <div className="space-y-4">
                {fusionProcesses.map(process => (
                  <div 
                    key={`fusion-${process.id}`} 
                    className="glass-card p-6 flex items-start gap-4 cursor-pointer hover:border-purple-500/50 transition-colors"
                    onClick={() => navigate(`/membership/fusion/${process.id}`)}
                  >
                    <div className="p-3 bg-purple-500/10 rounded-full">
                      <Handshake className="text-purple-400" size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold mb-1">Fusión con {process.external_org_name}</h3>
                        <span className={`badge ${process.stage === 'completed' ? 'badge-green' : process.stage === 'rejected' ? 'badge-red' : 'badge-purple'}`}>
                          {getStageLabel(process.stage)}
                        </span>
                      </div>
                      <p className="text-secondary text-sm mb-3">
                        Iniciado: {new Date(process.created_at).toLocaleDateString()}
                      </p>
                      <div className="text-sm bg-black/20 p-3 rounded text-secondary font-mono">
                        Propuesta Origen: #{process.initiator_proposal_id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Legacy Events */}
          <section>
            <h2 className="text-xl font-bold text-accent mb-4">Eventos Históricos (Directos)</h2>
            {events.length === 0 ? (
              <p className="text-secondary p-4 glass-card">No hay eventos organizacionales registrados.</p>
            ) : (
              <div className="space-y-4">
                {events.map(event => (
                  <div key={event.id} className="glass-card p-6 flex items-start gap-4 opacity-70">
                    <div className="p-3 bg-white/5 rounded-full">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold mb-1">{getEventTitle(event.event_type)}</h3>
                        <span className={`badge ${event.status === 'completed' ? 'badge-green' : 'badge-orange'}`}>
                          {event.status === 'completed' ? 'Completado' : 'En Progreso'}
                        </span>
                      </div>
                      <p className="text-secondary text-sm mb-3">
                        Iniciado el: {new Date(event.initiated_at).toLocaleDateString()}
                        {event.completed_at && ` • Completado el: ${new Date(event.completed_at).toLocaleDateString()}`}
                      </p>
                      <div className="text-sm bg-black/20 p-3 rounded text-secondary font-mono">
                        Propuesta Origen: #{event.proposal_id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default OrganizationEvents;
