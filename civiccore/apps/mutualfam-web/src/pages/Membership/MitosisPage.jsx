import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gobernanzaApi, mitosisApi } from '@civiccore/sdk';
import { ArrowLeft, SplitSquareHorizontal, Download, Users, AlertTriangle, CheckCircle } from 'lucide-react';

const MitosisPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [proposal, setProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // En una app real, esto podría venir de proposal.extra_fields.leaving_member_ids
  // Para propósitos de demostración, permitiremos ingresar IDs manualmente si no existen
  const [leavingMembers, setLeavingMembers] = useState('');

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    try {
      setIsLoading(true);
      const data = await gobernanzaApi.obtenerPropuesta(id);
      setProposal(data);
      if (data?.extra_fields?.leaving_member_ids) {
        setLeavingMembers(data.extra_fields.leaving_member_ids.join(', '));
      }
    } catch (error) {
      console.error(error);
      alert("Error al cargar la propuesta de escisión.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    const memberIds = leavingMembers.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (memberIds.length === 0) {
      return alert("Debe especificar al menos un ID de miembro saliente.");
    }

    try {
      setIsExporting(true);
      const payload = {
        leaving_member_ids: memberIds,
        snapshot_name: `Escision_${proposal.title.replace(/\s+/g, '_')}`
      };
      
      const response = await mitosisApi.exportSnapshot(payload);
      
      if (response.status === 'success') {
        alert(`Snapshot generado exitosamente.\nRuta en el servidor: ${response.file_path}`);
      }
    } catch (error) {
      alert(error.message || "Error al exportar el snapshot");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><div className="loader mx-auto"></div></div>;

  if (!proposal || proposal.proposal_type !== 'division') {
    return (
      <div className="p-8 text-center animate-fade-in">
        <AlertTriangle className="text-yellow-500 mx-auto mb-4" size={48} />
        <h2 className="text-xl font-bold">Proceso de escisión inválido</h2>
        <p className="text-secondary mt-2">La propuesta no fue encontrada o no es del tipo Escisión (Mitosis).</p>
        <button className="btn btn-secondary mt-6" onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  const isApproved = proposal.status === 'approved';

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mt-8 pb-12">
      <button 
        className="btn btn-secondary mb-6 border-none p-0 bg-transparent text-secondary hover:text-white flex items-center gap-2" 
        onClick={() => navigate(`/governance/${id}`)}
      >
        <ArrowLeft size={18} /> Volver a Propuesta
      </button>

      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-3 text-3xl font-bold">
          <SplitSquareHorizontal className="text-orange-500" size={32} />
          Proceso de Escisión (Mitosis)
        </h1>
        <p className="text-secondary mt-2 text-lg">
          Generación de Snapshot para la migración de miembros y capital hacia una nueva instancia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-8 border border-orange-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">Exportar Snapshot de Datos</h2>
            <p className="text-secondary mb-6">
              Esta herramienta permite descargar un archivo JSON que contiene los datos financieros y perfiles de los miembros que han decidido separarse para formar una nueva mutual.
            </p>

            {!isApproved ? (
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-red-300 flex items-start gap-3">
                <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm">La propuesta debe ser <strong>Aprobada</strong> antes de poder generar el Snapshot de salida.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                  <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Users size={16} className="text-orange-400" />
                    IDs de Miembros Salientes
                  </label>
                  <p className="text-xs text-secondary mb-3">Separados por coma. Ej: 2, 5, 12</p>
                  <input 
                    type="text" 
                    className="form-input bg-black/40 text-white w-full font-mono" 
                    value={leavingMembers} 
                    onChange={e => setLeavingMembers(e.target.value)} 
                    placeholder="Ej: 3, 7, 8"
                  />
                </div>

                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="btn bg-orange-600 hover:bg-orange-500 text-white w-full flex items-center justify-center gap-2 py-3 border-none shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                >
                  <Download size={20} />
                  {isExporting ? 'Generando Snapshot...' : 'Generar y Descargar Snapshot'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="glass-card p-6 border-t-4 border-t-orange-500">
            <h3 className="font-bold text-white mb-4 uppercase tracking-wider text-sm">Estado de la Propuesta</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-secondary text-xs">Propuesta Relacionada</span>
                <span className="font-bold text-white">{proposal.title}</span>
              </div>
              <div>
                <span className="block text-secondary text-xs">Estatus</span>
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-bold border border-green-500/30">
                    <CheckCircle size={12} /> Aprobada
                  </span>
                ) : (
                  <span className="inline-block mt-1 px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-bold border border-yellow-500/30">
                    {proposal.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MitosisPage;
