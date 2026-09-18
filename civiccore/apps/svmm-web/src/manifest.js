const manifest = {
  name: "SVMM",
  shortName: "SVMM",
  tagline: "Gobernanza para la Sociedad Venezolana de Medicina Mutualista",
  description: "Sistema de gestión para la sociedad científica.",

  logo: null,
  coverImage: null,
  faviconUrl: "/favicon.ico",

  theme: {
    primaryColor: "#1d4ed8",      // azul
    secondaryColor: "#3b82f6",    // azul claro
    fontFamily: "Inter, system-ui, sans-serif",
  },

  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8002/api/v1",

  modules: {
    governance:    true,
    transparency:  true,
    payments:      true,
    credits:       false,
    mercado:       false,
    members:       true,
    fusion:        true,
    board:         true,
    delegates:     false,
  },

  appMaturity: {
    version: "0.1.0",
    level: 1,
    state: "experimental",
    label: "Experimental"
  },

  supportEmail: "soporte@svmm.org.ve",
};

export default manifest;
