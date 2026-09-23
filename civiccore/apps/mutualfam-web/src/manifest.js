const manifest = {
  name: "MutualFam",
  shortName: "MFam",
  tagline: "Gestión de préstamos y aportes familiares",
  description: "Plataforma de gestión y gobernanza democrática para mutuales familiares.",

  logo: null,
  coverImage: null,
  faviconUrl: "/favicon.ico",

  theme: {
    primaryColor: "#7c3aed",      // var(--accent-primary)
    secondaryColor: "#a855f7",    // var(--accent-secondary)
    fontFamily: "Inter, system-ui, sans-serif",
  },

  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8002/api/v1",

  modules: {
    governance:    true,
    transparency:  true,
    payments:      true,
    credits:       true,
    mercado:       false,
    members:       true,
    fusion:        true,
    board:         true,
    delegates:     true,
  },

  appMaturity: {
    version: "1.0.0",
    level: 3,
    state: "stable",
    label: "Estable"
  },

  supportEmail: "soporte@mutualfam.com",
};

export default manifest;
