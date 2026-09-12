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
      const newProp = await gobernanzaApi.crearPropuesta(formData);
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
              <label className="form-label">Categoría</label>
              <select 
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                <option value="general">Propuesta General</option>
                <option value="configuracion">Cambio de Configuración del Sistema</option>
                <option value="financiamiento">Solicitud de Financiamiento</option>
              </select>
            </div>

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
