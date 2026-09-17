const manifest = {
  name: "MutualSol",
  shortName: "MSol",
  tagline: "Gobernanza Solidaria para tu Mutual",
  description: "Plataforma de gestión y gobernanza democrática para mutuales.",

  logo: null,
  coverImage: null,
  faviconUrl: "/favicon.ico",

  theme: {
    primaryColor: "#7c3aed",      // var(--accent-primary)
    secondaryColor: "#a855f7",    // var(--accent-secondary)
    fontFamily: "Inter, system-ui, sans-serif",
  },

  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8001/api/v1",

  modules: {
    governance:    true,
    transparency:  true,
    credits:       true,
    mercado:       true,
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

  supportEmail: "soporte@mutualsol.com",
};

export default manifest;
