import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserPlus } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore } from '@civiccore/sdk';

export default function RegisterScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();

  const handleRegister = async () => {
    if (!nombre || !apellido || !cedula || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor llena todos los campos.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    
    setLoading(true);
    try {
      await register({ nombre, apellido, cedula, email, password });
      // El store maneja la navegación al cambiar isAuthenticated
    } catch (error) {
      Alert.alert('Error de Registro', error.message || 'No se pudo completar el registro.');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} disabled={loading}>
            <ArrowLeft color={COLORS.text} size={24} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Únete a la Mutual</Text>
            <Text style={styles.subtitle}>Crea tu cuenta y forma parte de una economía solidaria.</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Nombre *</Text>
                <TextInput style={styles.input} placeholder="Ej. Carlos" placeholderTextColor={COLORS.textMuted} value={nombre} onChangeText={setNombre} editable={!loading} />
              </View>
              <View style={{ width: 12 }} />
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Apellido *</Text>
                <TextInput style={styles.input} placeholder="Ej. Mendoza" placeholderTextColor={COLORS.textMuted} value={apellido} onChangeText={setApellido} editable={!loading} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Cédula de Identidad *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. V-12345678"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="default"
              value={cedula}
              onChangeText={setCedula}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Correo Electrónico *</Text>
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

            <Text style={styles.inputLabel}>Contraseña *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Confirmar Contraseña *</Text>
            <TextInput
              style={styles.input}
              placeholder="Repite tu contraseña"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
            />

            <TouchableOpacity style={[styles.registerBtn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <UserPlus color={COLORS.background} size={20} />
                  <Text style={styles.registerBtnText}>Crear Cuenta</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              Al crear tu cuenta aceptas los <Text style={styles.link}>Términos y Condiciones</Text> y el <Text style={styles.link}>Estatuto Comunitario</Text> de MutualSol.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
  backBtn: { marginTop: 10, marginBottom: 20, width: 40, height: 40, justifyContent: 'center' },
  header: { marginBottom: 30 },
  title: { color: COLORS.accent, fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: COLORS.textMuted, fontSize: 16, lineHeight: 22 },
  formContainer: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row' },
  halfField: { flex: 1 },
  inputLabel: { color: COLORS.text, fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: COLORS.background, color: COLORS.text, borderRadius: 8, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  registerBtn: { backgroundColor: COLORS.accent, flexDirection: 'row', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 52 },
  btnDisabled: { opacity: 0.6 },
  registerBtnText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  termsContainer: { marginTop: 30, paddingHorizontal: 10 },
  termsText: { color: COLORS.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  link: { color: COLORS.accent, textDecorationLine: 'underline' },
});
