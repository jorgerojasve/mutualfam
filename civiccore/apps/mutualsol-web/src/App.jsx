import React, { useEffect } from 'react';
import { useAuthStore } from '@civiccore/sdk';

function App() {
  const { loadUser, isLoading, isAuthenticated, user, login, logout } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return <div>Cargando SDK...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', marginTop: '100px' }}>
        <h2>Iniciar Sesión</h2>
        <button onClick={() => login('admin@mutualsol.com', 'admin123')} style={{ padding: '10px' }}>
          Login (admin@mutualsol.com)
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard Analítico - MutualSol</h1>
      <p>Bienvenido, {user?.nombre} {user?.apellido}</p>
      <button onClick={logout} style={{ padding: '10px' }}>Cerrar Sesión</button>
      <hr />
      <p>El SDK se ha inicializado correctamente. Aquí irá el Panel de Gobernanza Web.</p>
    </div>
  );
}

export default App;
