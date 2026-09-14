import React, { useEffect, useState } from 'react';
import { membershipApi } from '@civiccore/sdk';
import { GitBranch, GitMerge, Clock, CheckCircle } from 'lucide-react';

const OrganizationEvents = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.obtenerEventosOrganizacion();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching organization events", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-secondary text-center p-8 glass-card">No hay eventos organizacionales registrados.</p>
          ) : (
            events.map(event => (
              <div key={event.id} className="glass-card p-6 flex items-start gap-4">
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
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizationEvents;
