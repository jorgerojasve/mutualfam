import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gobernanzaApi, boardApi, committeesApi } from '@civiccore/sdk';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import InteractiveEditor from '../../components/Governance/InteractiveEditor';

const CreateProposal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    proposal_type: 'standard',
    target_member_id: '',
    voting_mechanism: 'simple',
    is_anonymous: false,
    
    // Fusion Contact fields
    external_org_name: '',
    
    // Board Election fields
    slate_name: '',
    candidates: [
      { position: 'Presidente', member_id: '', bio: '' },
      { position: 'Secretario', member_id: '', bio: '' },
      { position: 'Tesorero', member_id: '', bio: '' },
      { position: 'Vocal 1', member_id: '', bio: '' },
      { position: 'Vocal 2', member_id: '', bio: '' }
    ],
    
    // Committee fields
    committee_name: '',
    committee_area: '',
    committee_lead_id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'board') {
      setFormData(prev => ({...prev, proposal_type: 'board_election'}));
    } else if (type === 'committee') {
      setFormData(prev => ({...prev, proposal_type: 'committee_create'}));
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.proposal_type === 'standard' && (!formData.title || !formData.content)) {
      alert("Por favor completa el título y contenido.");
      return;
    }
    
    try {
      setIsSubmitting(true);
      let newProp;
      
      if (formData.proposal_type === 'board_election') {
        const payload = {
          name: formData.slate_name,
          candidates: formData.candidates.map(c => ({
            position: c.position,
            member_id: parseInt(c.member_id),
            bio: c.bio || null
          }))
        };
        newProp = await boardApi.createElection(payload);
      } else if (formData.proposal_type === 'committee_create') {
        const payload = {
          name: formData.committee_name,
          area: formData.committee_area || null,
          lead_member_id: parseInt(formData.committee_lead_id)
        };
        newProp = await committeesApi.propose(payload);
      } else {
        const payload = {
          ...formData,
          target_member_id: formData.proposal_type === 'expulsion' ? parseInt(formData.target_member_id) : null,
          extra_fields: formData.proposal_type === 'fusion_contact' ? { external_org_name: formData.external_org_name } : undefined
        };
        newProp = await gobernanzaApi.crearPropuesta(payload);
      }
      
      alert("Propuesta creada exitosamente.");
      navigate(`/governance/${newProp.id}`);
    } catch (error) {
      alert(error.message || "Error al crear la propuesta");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button 
        className="btn btn-secondary mb-6" 
        onClick={() => navigate('/governance')}
        style={{ border: 'none', padding: '0', background: 'transparent', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} /> Cancelar y Volver
      </button>

      <div className="page-header">
        <h1 className="page-title">Crear Propuesta</h1>
        <p className="text-secondary">Redacta tu referendo para someterlo a la Asamblea Mutual.</p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-6 mb-8">
            <div className="form-group flex-1">
              <label className="form-label">Tipo de Propuesta</label>
              <select 
                className="form-input"
                value={formData.proposal_type}
                onChange={(e) => setFormData({...formData, proposal_type: e.target.value})}
              >
                <option value="standard">Estándar</option>
                <option value="expulsion">Expulsión de Miembro</option>
                <option value="division">División Organizacional</option>
                <option value="fusion">Fusión Organizacional (Legado)</option>
                <option value="fusion_contact">Contacto de Fusión (Progresiva)</option>
                <option value="board_election">Elección de Junta (Plancha)</option>
                <option value="committee_create">Creación de Comité</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Categoría</label>
              <select 
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                disabled={formData.proposal_type !== 'standard'}
              >
                <option value="general">Propuesta General</option>
                <option value="configuracion">Cambio de Configuración del Sistema</option>
                <option value="financiamiento">Solicitud de Financiamiento</option>
                <option value="automatica">Implementación Automática (Smart Contract)</option>
                <option value="humana">Acción Humana (Operativa)</option>
              </select>
            </div>
          </div>

          {['standard', 'expulsion', 'division', 'fusion', 'fusion_contact'].includes(formData.proposal_type) && (
            <>
              <div className="form-group mb-6">
                <label className="form-label">Título de la Propuesta</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Reducción de tasa de interés para préstamos de salud"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Contenido Detallado y Multimedia</label>
                <InteractiveEditor 
                  value={formData.content}
                  onChange={(val) => setFormData({...formData, content: val})}
                />
              </div>
            </>
          )}

          {formData.proposal_type === 'expulsion' && (
            <div className="form-group mb-6 p-4 border border-red-500 bg-red-500/10 rounded-lg">
              <label className="form-label text-red-500">ID del Miembro a Expulsar (Requerido)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Ej. 12"
                value={formData.target_member_id}
                onChange={(e) => setFormData({...formData, target_member_id: e.target.value})}
                required
              />
              <p className="text-sm text-red-400 mt-2">
                ⚠️ Umbral requerido: 75% a favor. Si se aprueba, se iniciará el período de apelación de 30 días.
              </p>
            </div>
          )}

          {formData.proposal_type === 'division' && (
            <div className="mb-6 p-4 border border-blue-500 bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-400 font-bold">
                🔵 División Organizacional
              </p>
              <p className="text-sm text-blue-400 mt-1">
                ⚠️ Umbral requerido: 75% a favor. Esta propuesta debe contener el detalle de cómo se dividirán los fondos y qué miembros pasarán a la nueva organización.
              </p>
            </div>
          )}

          {formData.proposal_type === 'fusion' && (
            <div className="mb-6 p-4 border border-yellow-500 bg-yellow-500/10 rounded-lg">
              <p className="text-sm text-yellow-400 font-bold">
                🟡 Fusión Organizacional (Directa)
              </p>
              <p className="text-sm text-yellow-400 mt-1">
                ⚠️ Umbral requerido: 66% a favor en ambas organizaciones. Detalla los términos del acuerdo de fusión.
              </p>
            </div>
          )}

          {formData.proposal_type === 'fusion_contact' && (
            <div className="mb-6 p-4 border border-purple-500 bg-purple-500/10 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-purple-400">Proponer Contacto de Fusión</h3>
              
              <div className="form-group mb-4">
                <label className="form-label text-purple-300">Nombre de la organización contactada</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Mutual Metropolitana"
                  value={formData.external_org_name}
                  onChange={(e) => setFormData({...formData, external_org_name: e.target.value})}
                  required
                />
              </div>
              <p className="text-sm text-purple-400 mt-1">
                ℹ️ Esta propuesta iniciará el <strong>Flujo Progresivo de Fusión</strong>. 
                Requiere 50% de aprobación para establecer el primer contacto formal.
              </p>
            </div>
          )}

          {formData.proposal_type === 'board_election' && (
            <div className="mb-6 border border-gray-600 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 text-accent">Postular Plancha Electoral</h3>
              
              <div className="form-group mb-6">
                <label className="form-label">Nombre de la Plancha</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Transparencia Mutual 2026"
                  value={formData.slate_name}
                  onChange={(e) => setFormData({...formData, slate_name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="form-label">Candidatos (Uno por Cargo)</label>
                {formData.candidates.map((cand, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-black/20 rounded border border-white/5 items-start">
                    <div className="w-1/3">
                      <span className="block text-sm font-bold text-gray-300 mb-2">{cand.position}</span>
                      <input 
                        type="number" 
                        className="form-input text-sm" 
                        placeholder="ID Miembro"
                        value={cand.member_id}
                        onChange={(e) => {
                          const newCands = [...formData.candidates];
                          newCands[idx].member_id = e.target.value;
                          setFormData({...formData, candidates: newCands});
                        }}
                        required
                      />
                    </div>
                    <div className="w-2/3">
                      <textarea 
                        className="form-input text-sm" 
                        rows="2"
                        placeholder="Breve biografía o propuesta del candidato (opcional)"
                        value={cand.bio}
                        onChange={(e) => {
                          const newCands = [...formData.candidates];
                          newCands[idx].bio = e.target.value;
                          setFormData({...formData, candidates: newCands});
                        }}
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.proposal_type === 'committee_create' && (
            <div className="mb-6 border border-gray-600 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 text-accent">Proponer Nuevo Comité</h3>
              
              <div className="form-group mb-4">
                <label className="form-label">Nombre del Comité</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Comité de Riesgos"
                  value={formData.committee_name}
                  onChange={(e) => setFormData({...formData, committee_name: e.target.value})}
                  required
                />
              </div>

              <div className="flex gap-4 mb-4">
                <div className="form-group w-1/2">
                  <label className="form-label">Área de Enfoque</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej. Finanzas y Auditoría"
                    value={formData.committee_area}
                    onChange={(e) => setFormData({...formData, committee_area: e.target.value})}
                  />
                </div>
                <div className="form-group w-1/2">
                  <label className="form-label">ID del Líder Propuesto</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Ej. 4"
                    value={formData.committee_lead_id}
                    onChange={(e) => setFormData({...formData, committee_lead_id: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-6 mb-8">
            <div className="form-group flex-1">
              <label className="form-label">Mecanismo de Votación</label>
              <select 
                className="form-input"
                value={formData.voting_mechanism}
                onChange={(e) => setFormData({...formData, voting_mechanism: e.target.value})}
                disabled={formData.category === 'configuracion'}
              >
                <option value="simple">Simple (1 persona = 1 voto)</option>
                <option value="ponderado">Ponderado (Requiere Puntos)</option>
                <option value="cuadratico">Cuadrático (Mayor equidad)</option>
              </select>
              {formData.category === 'configuracion' && (
                <p className="text-orange mt-2" style={{ fontSize: '0.75rem' }}>
                  El mecanismo Simple es obligatorio para cambios de configuración.
                </p>
              )}
            </div>
          </div>

          <div className="form-group mb-8 flex items-center gap-3">
            <input 
              type="checkbox" 
              id="anonymous"
              checked={formData.is_anonymous}
              onChange={(e) => setFormData({...formData, is_anonymous: e.target.checked})}
              style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="anonymous" className="text-secondary cursor-pointer">
              Publicar de forma anónima
            </label>
          </div>

          <div className="flex justify-end pt-6" style={{ borderTop: '1px solid var(--border-strong)' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
              disabled={isSubmitting}
            >
              <Save size={18} /> {isSubmitting ? 'Publicando...' : 'Publicar Propuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProposal;
