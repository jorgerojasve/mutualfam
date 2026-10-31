import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';
import { connectRealtime, disconnectRealtime } from '../utils/realtime';
import { isNetworkError } from '../utils/errors';

export const OrgContext = createContext();

export const OrgProvider = ({ children }) => {
  const [activeOrg, setActiveOrg] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchOrganizations = async () => {
    try {
      const data = await authApi.me();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      setIsOffline(false);
      await AsyncStorage.setItem('cached_organizations', JSON.stringify(orgs));
      return orgs;
    } catch (e) {
      console.warn("Error fetching organizations", e);
      if (isNetworkError(e)) {
        setIsOffline(true);
        // Si hay fallo de red, rescatar organizaciones cacheadas
        try {
          const cached = await AsyncStorage.getItem('cached_organizations');
          if (cached) {
            const parsed = JSON.parse(cached);
            setOrganizations(parsed);
            return parsed;
          }
        } catch (_) {}
        // Retornar null para indicar error de red y NO lista vacía confirmada
        return null;
      }
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
        await AsyncStorage.setItem('cached_active_org', JSON.stringify(targetOrg));
      } else if (orgs === null) {
        // Fallo de conexión de red: NO borrar activeOrg para no confundir al usuario
        try {
          const cachedOrg = await AsyncStorage.getItem('cached_active_org');
          if (cachedOrg) {
            setActiveOrg(JSON.parse(cachedOrg));
          } else if (orgId) {
            setActiveOrg({ id: orgId, name: 'Mi Mutual' });
          }
        } catch (_) {}
      } else {
        // Solo limpiar si explícitamente el servidor confirmó una lista vacía (HTTP 200 sin organizaciones)
        setActiveOrg(null);
        await AsyncStorage.removeItem('cached_active_org');
      }
    } catch (e) {
      console.warn("loadActiveOrg error:", e);
    } finally {
      setLoading(false);
    }
  };

  const retryConnection = async () => {
    setRetrying(true);
    try {
      await loadActiveOrg();
    } finally {
      setRetrying(false);
    }
  };

  const selectOrg = async (org) => {
    if (!org) return;
    await AsyncStorage.setItem('active_org_id', org.id.toString());
    await AsyncStorage.setItem('org_id', org.id.toString());
    await AsyncStorage.setItem('cached_active_org', JSON.stringify(org));
    setActiveOrg(org);
    await fetchOrganizations();
  };

  const clearOrg = async () => {
    await AsyncStorage.removeItem('active_org_id');
    await AsyncStorage.removeItem('org_id');
    await AsyncStorage.removeItem('cached_active_org');
    await AsyncStorage.removeItem('cached_organizations');
    setActiveOrg(null);
    setOrganizations([]);
    setIsOffline(false);
  };

  useEffect(() => {
    loadActiveOrg();
  }, []);

  // Canal en tiempo real: una conexión por mutual activa
  useEffect(() => {
    if (activeOrg?.id && !isOffline) connectRealtime(activeOrg.id);
    else disconnectRealtime();
  }, [activeOrg?.id, isOffline]);

  return (
    <OrgContext.Provider value={{
      activeOrg,
      organizations,
      loading,
      isOffline,
      setIsOffline,
      retrying,
      retryConnection,
      selectOrg,
      clearOrg,
      fetchOrganizations,
      loadActiveOrg
    }}>
      {children}
    </OrgContext.Provider>
  );
};
