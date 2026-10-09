import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';

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
      const orgId = await AsyncStorage.getItem('active_org_id');
      const orgs = await fetchOrganizations();
      
      if (orgId && orgs.length > 0) {
        const found = orgs.find(o => o.id.toString() === orgId);
        if (found) {
          setActiveOrg(found);
        } else {
          // Si el active_org_id no está en la lista, limpiar
          await AsyncStorage.removeItem('active_org_id');
          setActiveOrg(null);
        }
      } else {
        setActiveOrg(null);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const selectOrg = async (org) => {
    await AsyncStorage.setItem('active_org_id', org.id.toString());
    setActiveOrg(org);
    await fetchOrganizations();
  };

  const clearOrg = async () => {
    await AsyncStorage.removeItem('active_org_id');
    setActiveOrg(null);
    setOrganizations([]);
  };

  useEffect(() => {
    // Escuchar cambios no es necesario si siempre se llama loadActiveOrg al login,
    // pero podemos cargarlo inicialmente
    loadActiveOrg();
  }, []);

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
