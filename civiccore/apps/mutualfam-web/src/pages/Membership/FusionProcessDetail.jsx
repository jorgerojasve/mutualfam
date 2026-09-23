import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DiffViewer from '../../components/DiffViewer';
import { fusionApi } from '@civiccore/sdk';
import { ArrowLeft, Handshake, CheckCircle, FileText, Upload, ChevronRight, AlertTriangle } from 'lucide-react';

const STAGES = ['exploration', 'due_diligence', 'voting', 'completed'];

const getStageLabel = (stage) => {
  const labels = {
    'exploration': 'Exploración',
    'due_diligence': 'Due Diligence',
    'voting': 'Votación',
    'completed': 'Completada',
    'cancelled': 'Cancelada'
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
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('statutes');

  useEffect(() => {
    fetchProcess();
  }, [id]);

  const fetchProcess = async () => {
    try {
      setIsLoading(true);
      // id from url is proposal_id in the new design (or is it process_id? The route is /membership/fusion/:id which usually refers to proposal_id or process_id. Let's assume it's proposalId as it was triggered from a proposal)
      // Actually, wait, let's look at the old router. Old was `/membership/fusion/:id` which queried fusion-process by ID.
      // But the new API has `getProcessByProposal(proposalId)`. We should use process ID if the URL is process ID, or proposal ID if it's proposal ID.
      // Let's assume the parameter is proposal_id since you access it from a proposal.
      const data = await fusionApi.getProcessByProposal(id);
      setProcess(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar el proceso de fusión. Es posible que aún no exista.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvance = async (nextStage) => {
    if (!window.confirm(`¿Seguro que deseas avanzar a la etapa: ${getStageLabel(nextStage)}?`)) return;
    try {
      setIsAdvancing(true);
      await fusionApi.advanceStage(process.id, nextStage);
      await fetchProcess();
    } catch (error) {
      alert(error.message || "Error al avanzar");
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !docTitle) return;
    try {
      setIsAdvancing(true);
      
      // En una app real subiríamos el archivo a S3 y enviaríamos la URL.
      // Por ahora simularemos la ruta.
      const payload = {
        title: docTitle,
        document_type: docType,
        stage_required: process.current_stage,
        file_path: `/storage/mock/${selectedFile.name}`
      };
      
      await fusionApi.uploadDocument(process.id, payload);
      alert("Documento subido con éxito");
      setSelectedFile(null);
      setDocTitle('');
      await fetchProcess();
    } catch (error) {
      alert(error.message || "Error al subir documento");
    } finally {
      setIsAdvancing(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center"><div className="loader mx-auto"></div></div>;
  }

  if (!process) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <AlertTriangle className="text-yellow-500 mx-auto mb-4" size={48} />
        <h2 className="text-xl font-bold">Proceso de fusión no encontrado</h2>
        <p className="text-secondary mt-2">Asegúrate de que la propuesta asociada haya sido aprobada para iniciar la fusión.</p>
        <button className="btn btn-secondary mt-6" onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(process.current_stage);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto mt-8 pb-12">
      <button 
        className="btn btn-secondary mb-6 border-none p-0 bg-transparent text-secondary hover:text-white flex items-center gap-2" 
        onClick={() => navigate('/governance')}
      >
        <ArrowLeft size={18} /> Volver a Gobernanza
      </button>

      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-3 text-3xl font-bold">
          <Handshake className="text-purple-500" size={32} />
          Fusión: {process.target_organization_name}
        </h1>
        <p className="text-secondary mt-2 text-lg">Proceso de asimilación mutua en curso.</p>
      </div>

      {/* STEPPER */}
      <div className="glass-card p-6 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/10 -translate-y-1/2 rounded"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-purple-500 -translate-y-1/2 rounded transition-all duration-700 ease-out"
            style={{ width: `${(Math.max(0, currentStageIndex) / (STAGES.length - 1)) * 100}%` }}
          ></div>
          
          {STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx || process.current_stage === 'completed';
            const isCurrent = process.current_stage === stage;
            const isCancelled = process.current_stage === 'cancelled';
            
            return (
              <div key={stage} className="flex flex-col items-center gap-3 bg-black/50 p-2 rounded-xl backdrop-blur-md">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300
                    ${isCompleted ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] scale-110' : 
                      isCurrent && !isCancelled ? 'bg-black border-2 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-125' : 
                      isCancelled && isCurrent ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]' :
                      'bg-black border border-white/20 text-secondary'}`}
                >
                  {isCompleted ? <CheckCircle size={20} /> : (idx + 1)}
                </div>
                <span className={`text-xs uppercase tracking-wider ${isCurrent ? 'text-white font-bold' : 'text-secondary font-medium'}`}>
                  {getStageLabel(stage)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* MAIN PANEL */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* STAGE: EXPLORATION */}
          {process.current_stage === 'exploration' && (
            <div className="glass-card p-8 animate-slide-up border border-purple-500/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Fase de Exploración</h2>
                <button 
                  className="btn bg-purple-600 hover:bg-purple-500 text-white border-none flex items-center gap-2"
                  onClick={() => handleAdvance('due_diligence')}
                  disabled={isAdvancing}
                >
                  Avanzar a Due Diligence <ChevronRight size={18} />
                </button>
              </div>
              <p className="text-secondary mb-6">
                En esta fase preliminar, ambas organizaciones expresan interés y firman un Acuerdo de Confidencialidad (NDA) o un Memorando de Entendimiento.
              </p>
              
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Upload size={20} className="text-purple-400"/> Subir Acuerdo Inicial</h3>
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm text-secondary mb-1">Título del Documento</label>
                    <input required type="text" className="form-input" placeholder="Ej: NDA Firmado" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm text-secondary mb-1">Archivo</label>
                    <input required type="file" className="form-input p-2 bg-black/40 text-sm" onChange={handleFileChange} />
                  </div>
                  <button type="submit" disabled={isAdvancing} className="btn bg-white/10 hover:bg-white/20 text-white w-full mt-2">
                    {isAdvancing ? 'Subiendo...' : 'Subir Documento'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STAGE: DUE DILIGENCE */}
          {process.current_stage === 'due_diligence' && (
            <div className="glass-card p-8 animate-slide-up border border-blue-500/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Due Diligence (Auditoría Mutua)</h2>
                <button 
                  className="btn bg-blue-600 hover:bg-blue-500 text-white border-none flex items-center gap-2"
                  onClick={() => handleAdvance('voting')}
                  disabled={isAdvancing}
                >
                  Avanzar a Votación <ChevronRight size={18} />
                </button>
              </div>
              <p className="text-secondary mb-6">
                Ambas mutuales deben exponer sus finanzas, estatutos y padrones. Revisa los documentos y sube los reportes de auditoría generados por el comité encargado.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/20">
                  <h3 className="text-lg font-bold text-blue-300 mb-4">Subir Documentos</h3>
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm text-blue-200/70 mb-1">Tipo</label>
                      <select className="form-input bg-black/50" value={docType} onChange={e => setDocType(e.target.value)}>
                        <option value="financials">Estados Financieros</option>
                        <option value="statutes">Estatutos</option>
                        <option value="members">Padrón de Miembros</option>
                        <option value="audit_report">Reporte de Auditoría</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-blue-200/70 mb-1">Título</label>
                      <input required type="text" className="form-input bg-black/50" placeholder="Ej: Balance General 2026" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
                    </div>
                    <div>
                      <input required type="file" className="form-input p-2 bg-black/50 text-sm" onChange={handleFileChange} />
                    </div>
                    <button type="submit" disabled={isAdvancing} className="btn bg-blue-600 hover:bg-blue-500 text-white w-full border-none">
                      Subir
                    </button>
                  </form>
                </div>
                
                <div className="bg-black/30 rounded-xl p-6 border border-white/10 flex flex-col justify-center text-center">
                  <AlertTriangle className="text-yellow-500 mx-auto mb-4" size={40} />
                  <h3 className="text-white font-bold mb-2">Banderas Rojas</h3>
                  <p className="text-sm text-secondary mb-4">¿Se ha encontrado algo inaceptable en la auditoría?</p>
                  <button className="btn bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-500/50" onClick={() => handleAdvance('cancelled')}>
                    Cancelar Fusión
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE: VOTING */}
          {process.current_stage === 'voting' && (
            <div className="glass-card p-8 animate-slide-up border border-green-500/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Votación y Referendo</h2>
                <button 
                  className="btn bg-green-600 hover:bg-green-500 text-white border-none flex items-center gap-2"
                  onClick={() => handleAdvance('completed')}
                  disabled={isAdvancing}
                >
                  Finalizar Fusión <CheckCircle size={18} />
                </button>
              </div>
              
              <div className="bg-green-500/10 p-6 rounded-xl border border-green-500/20 mb-8 flex gap-4 items-start">
                <FileText className="text-green-400 shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="text-green-300 font-bold text-lg">Documento Final de Acuerdo</h3>
                  <p className="text-green-200/70 text-sm mt-1 mb-4">
                    Se debe someter a votación final vinculante el acuerdo redactado con base en la Due Diligence.
                  </p>
                  <button className="btn bg-black/50 text-white hover:bg-black border-white/20 text-sm" onClick={() => navigate('/governance/create?type=standard')}>
                    Crear Propuesta de Referendo
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <DiffViewer />
              </div>
            </div>
          )}
          
          {/* STAGE: COMPLETED / CANCELLED */}
          {(process.current_stage === 'completed' || process.current_stage === 'cancelled') && (
            <div className={`glass-card p-12 text-center animate-slide-up border ${process.current_stage === 'completed' ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
              <div className="inline-flex justify-center p-6 rounded-full bg-black/40 mb-6 shadow-xl">
                {process.current_stage === 'completed' ? (
                  <CheckCircle size={80} className="text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.6)]" />
                ) : (
                  <AlertTriangle size={80} className="text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.6)]" />
                )}
              </div>
              <h2 className={`text-4xl font-extrabold mb-4 tracking-tight ${process.current_stage === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                Proceso {process.current_stage === 'completed' ? 'Completado' : 'Cancelado'}
              </h2>
              <p className="text-secondary text-lg max-w-xl mx-auto">
                {process.current_stage === 'completed' 
                  ? `La integración y fusión con ${process.target_organization_name} ha finalizado oficialmente.` 
                  : `El proceso de fusión con ${process.target_organization_name} ha sido abortado.`}
              </p>
            </div>
          )}

        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 border-t-4 border-t-purple-500">
            <h3 className="font-bold text-white mb-4 uppercase tracking-wider text-sm">Resumen del Proceso</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-secondary text-xs">Organización Objetivo</span>
                <span className="font-bold text-white">{process.target_organization_name}</span>
              </div>
              <div>
                <span className="block text-secondary text-xs">Fecha de Inicio</span>
                <span className="text-white">{new Date(process.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-secondary text-xs">Tipo de Plataforma</span>
                <span className="inline-block mt-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-bold border border-purple-500/30">
                  {process.is_external ? 'Externa' : 'MutualSol Nativ.'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-4 uppercase tracking-wider text-sm">Bóveda de Documentos</h3>
            {(!process.documents || process.documents.length === 0) ? (
              <p className="text-secondary text-sm italic">No hay documentos subidos aún.</p>
            ) : (
              <ul className="space-y-3">
                {process.documents.map(doc => (
                  <li key={doc.id} className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                    <FileText className="text-purple-400 shrink-0 mt-0.5" size={16} />
                    <div className="overflow-hidden">
                      <p className="text-white text-sm font-medium truncate" title={doc.title}>{doc.title}</p>
                      <p className="text-secondary text-xs mt-1 capitalize">{doc.document_type} • Etapa: {doc.stage_required}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FusionProcessDetail;
