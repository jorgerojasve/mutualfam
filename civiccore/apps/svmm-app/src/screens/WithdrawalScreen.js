import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, AlertTriangle, Clock, CheckCircle } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { membershipApi, useAuthStore } from '@civiccore/sdk';

export default function WithdrawalScreen({ navigation }) {
  const { user } = useAuthStore();
  const [statusRecord, setStatusRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.estadoBaja();
      setStatusRecord(data);
    } catch (err) {
      if (!err.message.includes("404") && !err.message.includes("No withdrawal request found")) {
        Alert.alert("Error", err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = () => {
    Alert.alert(
      "Confirmar Solicitud",
      "¿Estás seguro de que deseas iniciar el proceso de baja voluntaria? Entrarás en un período de espera de 90 días.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          style: "destructive",
          onPress: async () => {
            try {
              await membershipApi.solicitarBaja();
              fetchStatus();
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleCancel = async () => {
    try {
      await membershipApi.cancelarBaja();
      setStatusRecord(null);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const userDays = user?.created_at ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Salida de la Mutual</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {statusRecord && statusRecord.status === 'pending' ? (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#eab308' }]}>
            <View style={styles.cardHeader}>
              <Clock color="#eab308" size={24} />
              <Text style={styles.cardTitle}>Solicitud en proceso</Text>
            </View>
            <Text style={styles.description}>
              Has solicitado tu baja de la mutual. Tu solicitud se hará efectiva el:{'\n'}
              <Text style={{ fontWeight: 'bold', color: COLORS.accent }}>
                {new Date(statusRecord.effective_at).toLocaleString()}
              </Text>
            </Text>
            
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Durante el período de espera, no podrás participar en asambleas ni votar. 
                Cualquier voto activo ha sido suspendido.
              </Text>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancelar solicitud de baja</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AlertTriangle color="#ef4444" size={24} />
              <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Solicitar Baja Voluntaria</Text>
            </View>
            <Text style={styles.description}>
              Al solicitar tu baja, iniciarás un período de espera de 90 días. Durante este tiempo, tus derechos políticos (voto, asamblea) serán suspendidos.
            </Text>

            <View style={styles.checklist}>
              <View style={styles.checklistItem}>
                <CheckCircle color="#22c55e" size={20} />
                <Text style={styles.checklistText}>
                  Debes tener al menos 15 días de antigüedad (Tienes {userDays} días).
                </Text>
              </View>
              <View style={styles.checklistItem}>
                <CheckCircle color="#22c55e" size={20} />
                <Text style={styles.checklistText}>
                  No debes tener créditos activos ni estar en estado de mora.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.requestButton} onPress={handleRequest}>
              <Text style={styles.requestButtonText}>Iniciar proceso de baja</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  description: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  warningBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 8, marginBottom: 20 },
  warningText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },
  checklist: { marginBottom: 25 },
  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  checklistText: { color: COLORS.textMuted, flex: 1, fontSize: 14, lineHeight: 20 },
  requestButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  requestButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { borderColor: '#ef4444', borderWidth: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)' },
  cancelButtonText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
