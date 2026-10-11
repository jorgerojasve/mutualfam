import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenTitle from '../components/ScreenTitle';
import { OrgContext } from '../context/OrgContext';
import { unregisterPushNotificationsAsync } from '../services/notifications';
import { getCurrentAppVersion, checkForAppUpdate } from '../services/appUpdates';
import UpdateModal from '../components/UpdateModal';

export default function ProfileScreen({ navigation }) {
  const { activeOrg, clearOrg } = useContext(OrgContext);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const currentVersion = getCurrentAppVersion();

  const handleLogout = async () => {
    try {
      await unregisterPushNotificationsAsync();
    } catch (_) {}
    await clearOrg();
    await AsyncStorage.multiRemove(['jwt_token', 'refresh_token']);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      if (result.hasUpdate) {
        setUpdateInfo(result);
      } else if (result.error) {
        Alert.alert(
          'Aviso',
          'No se pudo comprobar la versión en este momento. Revisa tu conexión a internet.'
        );
      } else {
        Alert.alert(
          '¡Estás al día!',
          `Tienes instalada la versión más reciente (v${currentVersion}).`
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrió un error al buscar actualizaciones.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitle title="Perfil y Ajustes" />

      {/* Tarjeta: Mi Mutual Activa */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="people-outline" size={20} color="#3b82f6" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>Mi Mutual Activa</Text>
        </View>
        <Text style={styles.cardText}>Nombre: <Text style={styles.highlightText}>{activeOrg?.name || 'Ninguna'}</Text></Text>
        <Text style={[styles.cardText, { marginBottom: 12 }]}>
          Rol: <Text style={styles.highlightText}>{activeOrg?.role === 'founder' ? 'Fundador' : 'Miembro'}</Text>
        </Text>

        <Text style={styles.helpText}>
          Si no puedes ver tus datos, es probable que tu sesión haya expirado o la base de datos se haya reiniciado.
        </Text>
      </View>

      {/* Tarjeta: Acerca de (About) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="information-circle-outline" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>Acerca de la App</Text>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Aplicación</Text>
          <Text style={styles.aboutValue}>Mutual Familiar</Text>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Versión</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionPillText}>v{currentVersion}</Text>
          </View>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Desarrollador</Text>
          <View style={styles.authorBadge}>
            <Ionicons name="code-slash-outline" size={16} color="#60a5fa" style={{ marginRight: 5 }} />
            <Text style={styles.authorText}>Jorge Rojas</Text>
          </View>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Analista de calidad</Text>
          <View style={styles.authorBadge}>
            <Ionicons name="checkmark-done-circle-outline" size={16} color="#34d399" style={{ marginRight: 5 }} />
            <Text style={styles.authorText}>Maira Salazar</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Botón de buscar actualizaciones */}
        <TouchableOpacity
          style={styles.checkUpdateButton}
          onPress={handleCheckUpdate}
          disabled={checkingUpdate}
          activeOpacity={0.8}
        >
          {checkingUpdate ? (
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="sync-outline" size={18} color="#38bdf8" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.checkUpdateButtonText}>
            {checkingUpdate ? 'Buscando actualizaciones...' : 'Buscar actualizaciones'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botón de Cerrar Sesión */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      {/* Modal de Actualización si se detecta una nueva versión al buscar manualmente */}
      <UpdateModal
        updateInfo={updateInfo}
        onDismiss={() => setUpdateInfo(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
  },
  highlightText: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  aboutLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  aboutValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  versionPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  versionPillText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  checkUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 11,
    borderRadius: 10,
  },
  checkUpdateButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

