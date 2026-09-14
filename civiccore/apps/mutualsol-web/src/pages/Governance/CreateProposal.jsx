import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gobernanzaApi } from '@civiccore/sdk';
import { ArrowLeft, Save } from 'lucide-react';

const CreateProposal = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    proposal_type: 'standard',
    target_member_id: '',
    voting_mechanism: 'simple',
    is_anonymous: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      alert("Por favor completa el título y contenido.");
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        target_member_id: formData.proposal_type === 'expulsion' ? parseInt(formData.target_member_id) : null
      };
      const newProp = await gobernanzaApi.crearPropuesta(payload);
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
            <label className="form-label">Contenido Detallado</label>
            <textarea 
              className="form-input" 
              rows="8" 
              placeholder="Explica detalladamente el contexto, el problema y la solución propuesta..."
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              required
            ></textarea>
          </div>

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
                <option value="fusion">Fusión Organizacional</option>
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
                🟡 Fusión Organizacional
              </p>
              <p className="text-sm text-yellow-400 mt-1">
                ⚠️ Umbral requerido: 66% a favor en ambas organizaciones. Detalla los términos del acuerdo de fusión.
              </p>
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
