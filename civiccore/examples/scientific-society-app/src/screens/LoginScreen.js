import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogIn, UserPlus } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore } from '@civiccore/sdk';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleStandardLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      // La navegación la maneja AppNavigator automáticamente al cambiar isAuthenticated
    } catch (error) {
      Alert.alert('Acceso Denegado', error.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>🤝 CivicCore</Text>
            <Text style={styles.subtitle}>Plataforma de la Sociedad Científica</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@correo.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <TouchableOpacity style={[styles.loginBtn, loading && styles.btnDisabled]} onPress={handleStandardLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <LogIn color={COLORS.background} size={20} />
                  <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No eres miembro todavía?</Text>
            <TouchableOpacity style={styles.registerBtn} onPress={() => navigation.navigate('Register')} disabled={loading}>
              <UserPlus color={COLORS.text} size={18} />
              <Text style={styles.registerBtnText}>Solicitar Membresía</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logo: { color: COLORS.accent, fontSize: 36, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center' },
  formContainer: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  inputLabel: { color: COLORS.text, fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: COLORS.background, color: COLORS.text, borderRadius: 8, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  loginBtn: { backgroundColor: COLORS.success, flexDirection: 'row', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 52 },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)', borderRadius: 8, backgroundColor: 'rgba(245, 166, 35, 0.1)' },
  biometricText: { color: COLORS.accent, marginLeft: 10, fontWeight: '600' },
  biometricTextMuted: { color: COLORS.textMuted },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { color: COLORS.textMuted, marginBottom: 10 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  registerBtnText: { color: COLORS.text, marginLeft: 8, fontWeight: '600' },
});
