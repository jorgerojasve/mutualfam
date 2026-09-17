import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@civiccore/sdk';
// Since this is a dev-only page, we bypass the main SDK temporarily if needed, 
// or use raw fetch to call our new sandbox endpoint
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';
const DB_MANAGER_URL = `${API_URL}/sandbox/db-manager`;

export default function DbManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const fetchBackups = async () => {
    try {
      const res = await fetch(`${DB_MANAGER_URL}/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setBackups(data.backups);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleBackup = async () => {
    const name = window.prompt("Ingresa un prefijo para el backup (ej. 'manual'):", "manual");
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${DB_MANAGER_URL}/backup?name_prefix=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert("Backup creado: " + data.backup_name);
        fetchBackups();
      } else {
        alert(data.detail || 'Error al crear backup');
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename) => {
    if (!window.confirm(`¿Estás SEGURO de restaurar ${filename}? Esto sobrescribirá la base de datos actual.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${DB_MANAGER_URL}/restore/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert("Restauración completada. Reinicia el servidor backend y luego refresca la página.");
      } else {
        alert(data.detail || 'Error al restaurar');
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div className="flex justify-between items-center mb-6">
          <h2>DB Manager (Entorno de Pruebas)</h2>
          <button 
            className="btn btn-primary" 
            onClick={handleBackup} 
            disabled={loading}
          >
            Crear Backup Actual
          </button>
        </div>

        <p className="mb-6 text-secondary">
          Gestiona los archivos SQLite de la base de datos local. Al restaurar un backup en caliente, asegúrate de reiniciar el servidor backend para evitar bloqueos del archivo (database is locked).
        </p>

        {backups.length === 0 ? (
          <div className="empty-state">No hay backups disponibles en la carpeta `backups/`.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Archivo</th>
                  <th style={{ padding: '1rem' }}>Fecha</th>
                  <th style={{ padding: '1rem' }}>Tamaño</th>
                  <th style={{ padding: '1rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}><strong>{b.name}</strong></td>
                    <td style={{ padding: '1rem' }}>{formatDate(b.created_at)}</td>
                    <td style={{ padding: '1rem' }}>{(b.size / 1024).toFixed(2)} KB</td>
                    <td style={{ padding: '1rem' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderColor: 'var(--accent)' }}
                        onClick={() => handleRestore(b.name)}
                        disabled={loading}
                      >
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
