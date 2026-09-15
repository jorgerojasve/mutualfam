import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, BookOpen, Banknote, Shield, ArrowRight, Bell } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

export default function DashboardScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bienvenido,</Text>
            <Text style={styles.logo}>Dr. Carlos Mendoza</Text>
            <Text style={styles.roleText}>Investigador • Biología Molecular</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Bell color={COLORS.accent} size={24} />
          </TouchableOpacity>
        </View>

        {/* Notificaciones Importantes */}
        <View style={styles.alertCard}>
          <Shield color={COLORS.accent} size={24} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertTitle}>Elección de Directiva en Curso</Text>
            <Text style={styles.alertDesc}>Tienes un voto pendiente en la asamblea general.</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Asamblea')}>
            <ArrowRight color={COLORS.accent} size={20} />
          </TouchableOpacity>
        </View>

        {/* Resumen */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Papers Publicados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>Active</Text>
            <Text style={styles.statLabel}>Status de Membresía</Text>
          </View>
        </View>

        {/* Acciones Rápidas */}
        <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Membresía')}>
            <View style={styles.iconWrapper}>
              <Users color={COLORS.accent} size={32} />
            </View>
            <Text style={styles.actionText}>Directorio</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Publicaciones')}>
            <View style={styles.iconWrapper}>
              <BookOpen color={COLORS.accent} size={32} />
            </View>
            <Text style={styles.actionText}>Repositorio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Finanzas')}>
            <View style={styles.iconWrapper}>
              <Banknote color={COLORS.accent} size={32} />
            </View>
            <Text style={styles.actionText}>Pagos</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  greeting: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },
  logo: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  notificationBtn: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    padding: 10,
    borderRadius: 20,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  alertTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  alertTitle: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  alertDesc: {
    color: COLORS.text,
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 35,
  },
  statBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '48%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNumber: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '31%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrapper: {
    backgroundColor: COLORS.background,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  }
});
