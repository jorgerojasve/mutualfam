import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Settings, Shield, Bell, Key, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore } from '@civiccore/sdk';

export default function SettingsScreen({ navigation }) {
  const { user } = useAuthStore();

  const settingsItems = [
    { icon: <Settings color={COLORS.textMuted} size={20} />, label: 'General', action: () => {} },
    { icon: <Shield color={COLORS.textMuted} size={20} />, label: 'Privacidad', action: () => {} },
    { icon: <Bell color={COLORS.textMuted} size={20} />, label: 'Notificaciones', action: () => {} },
    { icon: <Key color={COLORS.textMuted} size={20} />, label: 'Seguridad', action: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Nombre Completo</Text>
            <Text style={styles.profileValue}>{user?.nombre} {user?.apellido}</Text>
          </View>
          <View style={[styles.profileRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.profileLabel}>Correo</Text>
            <Text style={styles.profileValue}>{user?.email}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Preferencias</Text>
        <View style={styles.card}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.menuItem, index === settingsItems.length - 1 && { borderBottomWidth: 0 }]}
              onPress={item.action}
            >
              <View style={styles.menuItemLeft}>
                {item.icon}
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <ChevronRight color={COLORS.border} size={20} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: '#ef4444', marginTop: 10 }]}>Zona de Peligro</Text>
        <View style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AlertTriangle color="#ef4444" size={20} />
            <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16 }}>Acciones Irreversibles</Text>
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 15, lineHeight: 20 }}>
            Al iniciar el proceso de salida, tus derechos políticos serán suspendidos.
          </Text>
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => navigation.navigate('Withdrawal')}
          >
            <Text style={styles.dangerButtonText}>Gestionar Salida Voluntaria</Text>
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 15, marginBottom: 20 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  profileLabel: { color: COLORS.textMuted, fontSize: 14 },
  profileValue: { color: COLORS.text, fontWeight: '600' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  menuItemText: { color: COLORS.text, fontSize: 15 },
  dangerButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center' },
  dangerButtonText: { color: '#ef4444', fontWeight: 'bold' }
});
