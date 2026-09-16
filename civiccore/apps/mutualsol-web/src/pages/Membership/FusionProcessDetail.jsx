import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { membershipApi, gobernanzaApi } from '@civiccore/sdk';
import { ArrowLeft, Handshake, AlertTriangle, Upload, CheckCircle, FileText, Settings, Key, Shield, ChevronRight } from 'lucide-react';

const STAGES = ['intention', 'exploration', 'evaluation', 'negotiation', 'referendum', 'integration', 'completed'];

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

const FusionProcessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [process, setProcess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Negotiation state
  const [conflictPointsText, setConflictPointsText] = useState('');

  useEffect(() => {
    fetchProcess();
  }, [id]);

  const fetchProcess = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.getFusionProcess(id);
      setProcess(data);
      if (data.conflict_points && data.conflict_points.text) {
        setConflictPointsText(data.conflict_points.text);
      }
    } catch (error) {
      console.error(error);
      alert("Error al cargar el proceso");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvance = async (nextStage) => {
    if (!window.confirm(`¿Estás seguro de avanzar a la etapa: ${getStageLabel(nextStage)}?`)) return;
    try {
      setIsAdvancing(true);
      await membershipApi.advanceFusionProcess(id, nextStage);
      await fetchProcess();
    } catch (error) {
      alert(error.message || "Error al avanzar");
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSaveConflicts = async () => {
    try {
      await membershipApi.updateFusionData(id, { conflict_points: { text: conflictPointsText } });
      alert("Puntos de conflicto guardados.");
      await fetchProcess();
    } catch (error) {
      alert("Error guardando conflictos");
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleIntegrationUpload = async () => {
    if (!selectedFile) return;
    try {
      setIsAdvancing(true);
      await membershipApi.uploadFusionSnapshot(id, selectedFile);
      alert("Integración completada exitosamente.");
      await fetchProcess();
    } catch (error) {
      alert(error.message || "Error al procesar la integración");
    } finally {
      setIsAdvancing(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center"><div className="loader mx-auto"></div></div>;
  }

  if (!process) {
    return <div className="p-8 text-center">Proceso no encontrado.</div>;
  }

  const currentStageIndex = STAGES.indexOf(process.stage);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto mt-8 pb-12">
      <button 
        className="btn btn-secondary mb-6" 
        onClick={() => navigate('/membership/events')}
        style={{ border: 'none', padding: '0', background: 'transparent', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} /> Volver a Eventos
      </button>

      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-3">
          <Handshake className="text-purple-500" />
          Fusión: {process.external_org_name}
        </h1>
        <p className="text-secondary">Progreso de fusión progresiva mutua.</p>
      </div>

      {/* STEPPER */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/10 -z-10 -translate-y-1/2 rounded"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-purple-500 -z-10 -translate-y-1/2 rounded transition-all duration-500"
            style={{ width: `${(Math.max(0, currentStageIndex) / (STAGES.length - 1)) * 100}%` }}
          ></div>
          
          {STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx || process.stage === 'completed';
            const isCurrent = process.stage === stage;
            const isRejected = process.stage === 'rejected';
            
            return (
              <div key={stage} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
                    ${isCompleted ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 
                      isCurrent && !isRejected ? 'bg-black border-2 border-purple-500 text-purple-500' : 
                      isRejected && isCurrent ? 'bg-red-500 text-white' :
                      'bg-black border border-white/20 text-secondary'}`}
                >
                  {isCompleted ? <CheckCircle size={16} /> : (idx + 1)}
                </div>
                <span className={`text-xs ${isCurrent ? 'text-white font-bold' : 'text-secondary'}`}>
                  {getStageLabel(stage)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="space-y-8">
        
        {/* STAGE: INTENTION */}
        {process.stage === 'intention' && (
          <div className="glass-card p-8 text-center animate-slide-up">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">1. Intención de Contacto</h2>
            <p className="text-secondary mb-8 max-w-2xl mx-auto">
              La asamblea ha aprobado establecer el primer contacto con <strong>{process.external_org_name}</strong>. 
              Los representantes deben comunicarse formalmente para iniciar el proceso de exploración.
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => handleAdvance('exploration')}
              disabled={isAdvancing}
            >
              Marcar contacto como Exitoso (Avanzar a Exploración)
            </button>
            <div className="mt-4">
              <button 
                className="btn btn-secondary text-red-400 border-red-500/30"
                onClick={() => handleAdvance('rejected')}
                disabled={isAdvancing}
              >
                Rechazado por la otra parte
              </button>
            </div>
          </div>
        )}

        {/* STAGE: EXPLORATION */}
        {process.stage === 'exploration' && (
          <div className="glass-card p-8 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400">2. Exploración (Comparación)</h2>
              <button 
                className="btn btn-primary"
                onClick={() => handleAdvance('evaluation')}
                disabled={isAdvancing}
              >
                Avanzar a Evaluación <ChevronRight size={18} />
              </button>
            </div>
            
            <p className="text-secondary mb-6">
              En esta etapa se intercambia información pública: estatutos, misión y visión.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="border border-white/10 rounded-lg p-6 bg-black/20">
                <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                  <Shield size={18} className="text-blue-400" /> Nuestra Organización
                </h3>
                <ul className="space-y-3 text-secondary">
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Estatutos compartidos</li>
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Cifras públicas compartidas</li>
                </ul>
              </div>
              <div className="border border-white/10 rounded-lg p-6 bg-black/20">
                <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                  <Shield size={18} className="text-orange-400" /> {process.external_org_name}
                </h3>
                <ul className="space-y-3 text-secondary">
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Estatutos recibidos</li>
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Cifras públicas recibidas</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="font-bold text-lg mb-4 text-accent">Registro de Diferencias (Para futura Negociación)</h3>
              <textarea
                className="form-input"
                rows={6}
                placeholder="Anota aquí las diferencias en cuotas, quórum, días de retiro, etc..."
                value={conflictPointsText}
                onChange={(e) => setConflictPointsText(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <button className="btn btn-secondary" onClick={handleSaveConflicts}>Guardar Diferencias</button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE: EVALUATION */}
        {process.stage === 'evaluation' && (
          <div className="glass-card p-8 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400">3. Evaluación (Due Diligence)</h2>
              <button 
                className="btn btn-primary"
                onClick={() => handleAdvance('negotiation')}
                disabled={isAdvancing}
              >
                Iniciar Negociación <ChevronRight size={18} />
              </button>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 flex gap-3">
              <AlertTriangle className="text-yellow-500 shrink-0" />
              <div>
                <p className="text-yellow-200 font-bold">Auditoría Confidencial</p>
                <p className="text-yellow-200/80 text-sm">Ambas organizaciones acceden a datos sensibles (agregados). Requiere acuerdo de confidencialidad firmado (NDA).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-white/10 rounded-lg p-6 bg-black/20">
                <h3 className="font-bold text-lg mb-4 text-white">Datos Revelados</h3>
                <ul className="space-y-3 text-secondary">
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Finanzas Consolidadas</li>
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Activos y Pasivos</li>
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Cartera de Créditos Activos</li>
                  <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Estructura Demográfica de Membresía</li>
                </ul>
              </div>
              <div className="border border-white/10 rounded-lg p-6 flex flex-col justify-center text-center">
                <p className="text-secondary mb-4">¿Se han detectado banderas rojas financieras o legales insalvables?</p>
                <div className="flex gap-4 justify-center">
                  <button className="btn btn-secondary text-red-400" onClick={() => handleAdvance('rejected')}>
                    Sí, Cancelar Fusión
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE: NEGOTIATION */}
        {process.stage === 'negotiation' && (
          <div className="glass-card p-8 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400">4. Mesa de Negociación</h2>
              <button 
                className="btn btn-primary"
                onClick={() => handleAdvance('referendum')}
                disabled={isAdvancing}
              >
                Ir a Referendo Final <ChevronRight size={18} />
              </button>
            </div>
            
            <p className="text-secondary mb-6">
              En base a la información recolectada, los representantes negocian los términos finales del acuerdo.
            </p>

            <div className="border border-white/10 rounded-lg p-6 bg-black/20 mb-6">
              <h3 className="font-bold text-lg mb-4 text-white">Puntos de Conflicto (Identificados en Exploración)</h3>
              <textarea
                className="form-input font-mono text-sm"
                rows={8}
                value={conflictPointsText}
                onChange={(e) => setConflictPointsText(e.target.value)}
              />
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-secondary">Actualiza este texto a medida que se logran acuerdos.</p>
                <button className="btn btn-secondary" onClick={handleSaveConflicts}>Actualizar Acuerdos</button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE: REFERENDUM */}
        {process.stage === 'referendum' && (
          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-purple-400 mb-6">5. Referendo Final de Aprobación</h2>
            
            <p className="text-secondary mb-6">
              Se debe crear una propuesta de tipo <strong>Fusión Organizacional (Directa)</strong> en el sistema de Gobernanza de ambas organizaciones con los términos acordados.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="border border-white/10 rounded-lg p-6 bg-black/20 text-center">
                <h3 className="font-bold text-lg mb-2">Votación Interna</h3>
                <p className="text-sm text-secondary mb-4">Requiere 66% de aprobación.</p>
                <button className="btn btn-secondary" onClick={() => navigate('/governance/create?type=standard')}>
                  Crear Propuesta de Fusión
                </button>
              </div>
              <div className="border border-white/10 rounded-lg p-6 bg-black/20 text-center">
                <h3 className="font-bold text-lg mb-2">Votación Externa ({process.external_org_name})</h3>
                <p className="text-sm text-secondary mb-4">Se requiere que la contraparte también apruebe el acuerdo.</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button 
                className="btn btn-primary"
                onClick={() => handleAdvance('integration')}
                disabled={isAdvancing}
              >
                Ambas asambleas aprobaron (Avanzar a Integración)
              </button>
              <button 
                className="btn btn-secondary text-red-400"
                onClick={() => handleAdvance('rejected')}
                disabled={isAdvancing}
              >
                Rechazado en Asambleas
              </button>
            </div>
          </div>
        )}

        {/* STAGE: INTEGRATION */}
        {process.stage === 'integration' && (
          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-purple-400 mb-6">6. Integración Técnica</h2>
            
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-purple-300 mb-2">Fusión Manual (Subida de Snapshot)</h3>
              <p className="text-secondary text-sm mb-4">
                Sube el archivo <code className="text-purple-200">snapshot.json</code> exportado desde la plataforma de {process.external_org_name}. Esto asimilará a sus miembros y capital a nuestra organización.
              </p>
              
              <div className="flex items-center gap-4">
                <label className="btn btn-secondary cursor-pointer">
                  <Upload size={18} />
                  Seleccionar JSON
                  <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
                </label>
                {selectedFile && <span className="text-sm text-purple-200 font-mono">{selectedFile.name}</span>}
              </div>
              
              <div className="mt-6 pt-6 border-t border-purple-500/20">
                <button 
                  className="btn btn-primary w-full"
                  onClick={handleIntegrationUpload}
                  disabled={!selectedFile || isAdvancing}
                >
                  {isAdvancing ? 'Procesando Fusión...' : 'Ejecutar Fusión e Importar Datos'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE: COMPLETED / REJECTED */}
        {(process.stage === 'completed' || process.stage === 'rejected') && (
          <div className={`glass-card p-8 text-center animate-slide-up border ${process.stage === 'completed' ? 'border-green-500/30' : 'border-red-500/30'}`}>
            <div className="flex justify-center mb-4">
              {process.stage === 'completed' ? (
                <CheckCircle size={64} className="text-green-500" />
              ) : (
                <AlertTriangle size={64} className="text-red-500" />
              )}
            </div>
            <h2 className={`text-3xl font-bold mb-4 ${process.stage === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
              Proceso {process.stage === 'completed' ? 'Completado' : 'Rechazado'}
            </h2>
            <p className="text-secondary max-w-2xl mx-auto">
              {process.stage === 'completed' 
                ? `La fusión con ${process.external_org_name} ha finalizado con éxito. Los datos han sido integrados.` 
                : `El proceso de fusión con ${process.external_org_name} fue cancelado o rechazado.`}
            </p>
            
            {process.external_data?.integration_result && (
              <div className="mt-8 text-left bg-black/30 p-6 rounded-lg font-mono text-sm overflow-x-auto">
                <h3 className="text-green-400 font-bold mb-4">Resultado de Integración</h3>
                <pre className="text-secondary">
                  {JSON.stringify(process.external_data.integration_result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default FusionProcessDetail;
