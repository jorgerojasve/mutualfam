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
      
      // Extraer terminología de la BD
      const termGov = data.find(c => c.key === 'TERM_GOVERNANCE')?.value || 'Gobernanza';
      const termTrans = data.find(c => c.key === 'TERM_TRANSPARENCY')?.value || 'Transparencia';
      const termMem = data.find(c => c.key === 'TERM_MEMBERS')?.value || 'Miembros';

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
        configs: data, 
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
