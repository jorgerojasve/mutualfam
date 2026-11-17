const manifest = {
  name: "Mutual Familiar",
  shortName: "Mutual Familiar",
  tagline: "Gestión de préstamos y aportes familiares",
  description: "Plataforma de gestión y gobernanza democrática para mutuales familiares.",

  logo: "/logo.png",
  coverImage: null,
  faviconUrl: "/favicon.ico",

  theme: {
    fontFamily: "Inter, system-ui, sans-serif",
  },

  apiUrl: (import.meta.env.VITE_API_URL || "http://localhost:8002/api/v1")
    .toString()
    .trim()
    .replace(/[\r\n\t]/g, '')
    .replace(/\/+$/, ''),
  organizationId: import.meta.env.VITE_ORGANIZATION_ID || "1",

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
    version: "1.0.41",
    level: 3,
    state: "stable",
    label: "Estable"
  },

  supportEmail: "mutualfam@gmail.com",
};

export default manifest;
