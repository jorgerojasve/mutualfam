import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { authApi } from '../api/client';
import { extractInviteCode, getInviteFromClipboard, dismissClipboardInvite } from '../utils/invite';

export default function LoginScreen({ route, navigation }) {
  const [isRegistering, setIsRegistering] = useState(route?.params?.intent === 'register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState(null); // { token, organization_name }

  useEffect(() => {
    // Capa 2 del flujo de invitación: el usuario acaba de instalar el APK y abrió
    // la app directamente (perdiendo el deep link). Recuperamos la invitación desde
    // AsyncStorage o desde el enlace que el Landing Page copió al portapapeles.
    const detectInvite = async () => {
      let code = extractInviteCode(await AsyncStorage.getItem('pending_join_token'));
      if (!code) code = await getInviteFromClipboard();
      if (!code) return;
      try {
        const { data } = await apiClient.get(`/membership/invites/${encodeURIComponent(code)}`);
        const token = data.token || code;
        await AsyncStorage.setItem('pending_join_token', token);
        setInvite({ token, organization_name: data.organization_name });
        setIsRegistering(true);
      } catch (e) {
        // Invitación inválida o expirada: no molestamos al usuario
        await AsyncStorage.removeItem('pending_join_token');
      }
    };
    detectInvite();
  }, []);

  const discardInvite = async () => {
    if (invite) await dismissClipboardInvite(invite.token);
    await AsyncStorage.removeItem('pending_join_token');
    setInvite(null);
  };

  const handleSubmit = async () => {
    if (!email || !password || (isRegistering && !fullName)) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }
    
    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Por favor ingresa un correo válido');
      return;
    }
    
    // Validar longitud de contraseña
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (isRegistering && password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    
    setLoading(true);
    try {
      if (isRegistering) {
        await authApi.register(email, password, fullName);
        Alert.alert('Éxito', 'Cuenta creada exitosamente. Iniciando sesión...');
        
        // Auto login
        const data = await authApi.login(email, password);
        await AsyncStorage.multiSet([
          ['jwt_token', data.access_token],
          ['refresh_token', data.refresh_token]
        ]);
        
        // Check for pending join token first
        const pendingToken = await AsyncStorage.getItem('pending_join_token');
        if (pendingToken) {
          navigation.replace('JoinMutual', { token: pendingToken });
          return;
        }

        // El nuevo usuario no tiene mutual, así que vamos a la selección/creación
        navigation.replace('SelectMutual');
      } else {
        const data = await authApi.login(email, password);
        await AsyncStorage.multiSet([
          ['jwt_token', data.access_token],
          ['refresh_token', data.refresh_token]
        ]);
        
        // Check for pending join token first
        const pendingToken = await AsyncStorage.getItem('pending_join_token');
        if (pendingToken) {
          navigation.replace('JoinMutual', { token: pendingToken });
          return;
        }

        const me = await authApi.me();
        if (me.organizations && me.organizations.length > 0) {
          if (me.organizations.length === 1) {
             await AsyncStorage.setItem('org_id', me.organizations[0].id.toString());
             navigation.replace('MainTabs');
          } else {
             navigation.replace('SelectMutual');
          }
        } else {
          // No tiene organizaciones, debe crear o unirse a una
          navigation.replace('SelectMutual');
        }
      }
    } catch (error) {
      Alert.alert(isRegistering ? 'Error al registrar' : 'Error de inicio de sesión', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {invite && (
        <View style={styles.inviteBanner}>
          <Text style={styles.inviteBannerTitle}>🎉 Te invitaron a {invite.organization_name}</Text>
          <Text style={styles.inviteBannerText}>
            {isRegistering
              ? 'Crea tu cuenta y te uniremos automáticamente a la mutual.'
              : 'Inicia sesión y te uniremos automáticamente a la mutual.'}
          </Text>
          <TouchableOpacity onPress={discardInvite}>
            <Text style={styles.inviteBannerDismiss}>No es para mí</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.card}>
        <View style={styles.iconPlaceholder} />
        <Text style={styles.title}>Mutual Familiar</Text>
        
        {isRegistering && (
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
            value={fullName}
            onChangeText={setFullName}
          />
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Contraseña"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={{color: '#94a3b8'}}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
          </TouchableOpacity>
        </View>

        {isRegistering && (
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirmar contraseña"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isRegistering ? 'Crear cuenta' : 'Iniciar Sesión'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => setIsRegistering(!isRegistering)}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  inviteBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inviteBannerTitle: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inviteBannerText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  inviteBannerDismiss: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: '#1e293b', // Slate 800
    padding: 30,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    color: '#f8fafc',
    fontSize: 16,
  },
  passwordContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    color: '#f8fafc',
    fontSize: 16,
  },
  eyeButton: {
    padding: 15,
  },
  button: {
    width: '100%',
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    marginTop: 20,
    paddingVertical: 10,
  },
  switchText: {
    color: '#94a3b8',
    fontSize: 14,
    textDecorationLine: 'underline',
  }
});
