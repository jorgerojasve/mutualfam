import { create } from 'zustand';
import { configApi } from './api.js';

export const useConfigStore = create((set, get) => ({
  configs: [],
  terminology: {
    governance: 'Gobernanza',
    transparency: 'Transparencia',
    members: 'Miembros'
  },
  isLoading: true,

  loadConfigs: async () => {
    try {
      const data = await configApi.getVariables();
      
      // Extraer terminología de la BD
      const termGov = data.find(c => c.key === 'TERM_GOVERNANCE')?.value || 'Gobernanza';
      const termTrans = data.find(c => c.key === 'TERM_TRANSPARENCY')?.value || 'Transparencia';
      const termMem = data.find(c => c.key === 'TERM_MEMBERS')?.value || 'Miembros';

      set({ 
        configs: data, 
        terminology: {
          governance: termGov,
          transparency: termTrans,
          members: termMem
        },
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
