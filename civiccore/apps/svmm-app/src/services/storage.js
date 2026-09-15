let mockStore = {};

const TOKEN_KEY = 'token';

// Usamos almacenamiento en memoria para el prototipo para no obligar a instalar librerías nativas adicionales
export const saveToken = async (token) => { mockStore[TOKEN_KEY] = token; };
export const getToken = async () => mockStore[TOKEN_KEY] || null;
export const removeToken = async () => { delete mockStore[TOKEN_KEY]; };
