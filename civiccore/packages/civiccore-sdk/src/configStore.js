import { create } from 'zustand';
import { configApi } from './api.js';

export const useConfigStore = create((set, get) => ({
  configs: [],
  terminology: {
    governance: 'Gobernanza',
    transparency: 'Transparencia',
    members: 'Miembros'
  },
  maturity: {
    framework: null,
    modules: {}
  },
  isLoading: true,

  loadConfigs: async () => {
    try {
      const data = await configApi.getVariables();
      
      // Asegurar lista segura incluso si el endpoint devuelve un objeto dict
      const list = Array.isArray(data) ? data : (Array.isArray(data?.variables) ? data.variables : []);

      // Extraer terminología de la BD o defaults
      const termGov = list.find(c => c.key === 'TERM_GOVERNANCE')?.value || 'Gobernanza';
      const termTrans = list.find(c => c.key === 'TERM_TRANSPARENCY')?.value || 'Transparencia';
      const termMem = list.find(c => c.key === 'TERM_MEMBERS')?.value || 'Miembros';

      // Cargar data de madurez
      let maturityData = { framework: null, modules: {} };
      try {
        const rawMaturity = await configApi.getMaturity();
        
        // Helper to add label based on state
        const enrich = (item) => {
          if (!item) return item;
          const labels = {
            stable: 'Estable',
            beta: 'Beta',
            experimental: 'Experimental'
          };
          return { ...item, label: labels[item.state] || item.state };
        };

        if (rawMaturity?.framework) {
          maturityData.framework = enrich(rawMaturity.framework);
        }
        if (rawMaturity?.modules) {
          Object.keys(rawMaturity.modules).forEach(k => {
            maturityData.modules[k] = enrich(rawMaturity.modules[k]);
          });
        }
      } catch (err) {
        console.warn("Maturity data could not be loaded from API, relying on defaults.", err);
      }

      set({ 
        configs: list,
        rawConfig: data,
        terminology: {
          governance: termGov,
          transparency: termTrans,
          members: termMem
        },
        maturity: maturityData,
        isLoading: false 
      });
    } catch (error) {
      console.error("Error cargando configs", error);
      set({ isLoading: false });
    }
  },

  getTerm: (key) => {
    return get().terminology[key] || key;
  }
}));
