import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import {
  extractInviteCode,
  formatInviteCode,
  getInviteFromClipboard,
  pasteInviteFromClipboard,
  dismissClipboardInvite,
} from '../utils/invite';
import { OrgContext } from '../context/OrgContext';

export default function JoinMutualScreen({ route, navigation }) {
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [mutualInfo, setMutualInfo] = useState(null);
  const [fromClipboard, setFromClipboard] = useState(false);
  const { loadActiveOrg } = React.useContext(OrgContext);

  useEffect(() => {
    const init = async () => {
      // 1) Viene desde un deep link (mutualfam://join/TOKEN) o desde Login/SelectMutual
      const paramCode = extractInviteCode(route.params?.token);
      if (paramCode) {
        setInput(formatInviteCode(paramCode));
        checkToken(paramCode);
        return;
      }
      // 2) Invitación pendiente guardada antes de registrarse
      const pending = extractInviteCode(await AsyncStorage.getItem('pending_join_token'));
      if (pending) {
        setInput(formatInviteCode(pending));
        checkToken(pending);
        return;
      }
      // 3) Enlace de invitación copiado en el portapapeles (Landing Page / WhatsApp)
      const clip = await getInviteFromClipboard();
      if (clip) {
        setFromClipboard(true);
        setInput(formatInviteCode(clip));
        checkToken(clip);
      }
    };
    init();
  }, [route.params?.token]);

  const checkToken = async (rawValue) => {
    const code = extractInviteCode(rawValue);
    if (!code) {
      Alert.alert(
        'Código no válido',
        'Escribe el código de 8 caracteres que aparece en tu invitación (ej. K7P3-QX9M) o pega el enlace completo que te enviaron.'
      );
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/membership/invites/${encodeURIComponent(code)}`);
      setToken(data.token || code);
      setMutualInfo(data);
    } catch (e) {
      Alert.alert('Invitación no encontrada', e.response?.data?.detail || 'El código es inválido o ya expiró. Pide una nueva invitación.');
      setMutualInfo(null);
      setFromClipboard(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    const { text, code } = await pasteInviteFromClipboard();
    if (!text) {
      Alert.alert('Portapapeles vacío', 'Primero copia el enlace o código de invitación que te enviaron.');
      return;
    }
    setInput(code ? formatInviteCode(code) : text);
    if (code) checkToken(code);
  };

  const handleJoin = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const jwtToken = await AsyncStorage.getItem('jwt_token');
      if (!jwtToken) {
        // Aún no tiene cuenta: guardamos la invitación y lo mandamos a registrarse
        await AsyncStorage.setItem('pending_join_token', token);
        Alert.alert('Un paso más', 'Crea tu cuenta (o inicia sesión) y te uniremos automáticamente a la mutual.');
        navigation.replace('Login', { intent: 'register' });
        return;
      }

      const { data } = await apiClient.post('/membership/organizations/join', { token });
      await AsyncStorage.removeItem('pending_join_token');
      await dismissClipboardInvite(token);
      Alert.alert('¡Bienvenido!', data.message || 'Te has unido exitosamente.');

      await AsyncStorage.setItem('active_org_id', data.organization_id.toString());
      await loadActiveOrg();
      navigation.replace('MainTabs');
    } catch (e) {
      if (e.response?.status === 401) {
        await AsyncStorage.setItem('pending_join_token', token);
        Alert.alert('Sesión expirada', 'Debes iniciar sesión nuevamente para unirte.');
        navigation.replace('Login');
      } else {
        Alert.alert('Error', e.response?.data?.detail || 'No se pudo procesar la invitación');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await AsyncStorage.removeItem('pending_join_token');
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Abierto directamente por deep link: no hay pantalla anterior
    const jwtToken = await AsyncStorage.getItem('jwt_token');
    navigation.replace(jwtToken ? 'SelectMutual' : 'Login');
  };

  const resetCode = () => {
    setMutualInfo(null);
    setToken('');
    setInput('');
    setFromClipboard(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirse a una Mutual</Text>

      {!mutualInfo ? (
        <>
          <Text style={styles.subtitle}>
            Escribe el código de invitación que te enviaron (aparece en el mensaje y en la página de invitación).
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. K7P3-QX9M"
            placeholderTextColor="#64748b"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => checkToken(input)}
            returnKeyType="go"
          />
          <TouchableOpacity style={styles.pasteButton} onPress={handlePaste} disabled={loading}>
            <Text style={styles.pasteText}>📋 Pegar enlace o código copiado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, (!input || loading) && styles.buttonMuted]}
            onPress={() => checkToken(input)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verificar Código</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.infoCard}>
          {fromClipboard && (
            <Text style={styles.detectedBadge}>✨ Detectamos tu invitación automáticamente</Text>
          )}
          <Text style={styles.infoTitle}>Has sido invitado a:</Text>
          <Text style={styles.orgName}>{mutualInfo.organization_name}</Text>
          {!!mutualInfo.code && <Text style={styles.codeText}>Código {mutualInfo.code}</Text>}

          <TouchableOpacity
            style={[styles.button, styles.fullWidth, { marginTop: 20 }]}
            onPress={handleJoin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar y Unirme</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={resetCode} disabled={loading}>
            <Text style={styles.linkText}>Usar otro código</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 30,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    fontSize: 22,
    letterSpacing: 3,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pasteButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  pasteText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonMuted: {
    opacity: 0.6,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  detectedBadge: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
  },
  infoTitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 10,
  },
  orgName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  codeText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 1,
  },
  linkButton: {
    marginTop: 14,
    padding: 6,
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
