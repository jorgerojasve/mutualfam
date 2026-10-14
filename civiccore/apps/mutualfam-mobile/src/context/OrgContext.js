import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';
import { connectRealtime, disconnectRealtime } from '../utils/realtime';

export const OrgContext = createContext();

export const OrgProvider = ({ children }) => {
  const [activeOrg, setActiveOrg] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    try {
      const data = await authApi.me();
      setOrganizations(data.organizations || []);
      return data.organizations || [];
    } catch (e) {
      console.warn("Error fetching organizations", e);
      return [];
    }
  };

  const loadActiveOrg = async () => {
    setLoading(true);
    try {
      const orgId = (await AsyncStorage.getItem('active_org_id')) || (await AsyncStorage.getItem('org_id'));
      const orgs = await fetchOrganizations();
      
      if (orgs && orgs.length > 0) {
        let found = null;
        if (orgId) {
          found = orgs.find(o => o.id.toString() === orgId.toString());
        }
        // Fallback: Si no hay orgId o el que estaba guardado ya no existe, auto-seleccionar la primera mutual disponible
        const targetOrg = found || orgs[0];
        setActiveOrg(targetOrg);
        await AsyncStorage.setItem('active_org_id', targetOrg.id.toString());
        await AsyncStorage.setItem('org_id', targetOrg.id.toString());
      } else {
        // Solo limpiar si explícitamente se obtuvo una lista vacía confirmada
        setActiveOrg(null);
      }
    } catch (e) {
      console.warn("loadActiveOrg error:", e);
    } finally {
      setLoading(false);
    }
  };

  const selectOrg = async (org) => {
    if (!org) return;
    await AsyncStorage.setItem('active_org_id', org.id.toString());
    await AsyncStorage.setItem('org_id', org.id.toString());
    setActiveOrg(org);
    await fetchOrganizations();
  };

  const clearOrg = async () => {
    await AsyncStorage.removeItem('active_org_id');
    await AsyncStorage.removeItem('org_id');
    setActiveOrg(null);
    setOrganizations([]);
  };

  useEffect(() => {
    // Escuchar cambios no es necesario si siempre se llama loadActiveOrg al login,
    // pero podemos cargarlo inicialmente
    loadActiveOrg();
  }, []);

  // Canal en tiempo real: una conexión por mutual activa
  useEffect(() => {
    if (activeOrg?.id) connectRealtime(activeOrg.id);
    else disconnectRealtime();
  }, [activeOrg?.id]);

  return (
    <OrgContext.Provider value={{
      activeOrg,
      organizations,
      loading,
      selectOrg,
      clearOrg,
      fetchOrganizations,
      loadActiveOrg
    }}>
      {children}
    </OrgContext.Provider>
  );
};
