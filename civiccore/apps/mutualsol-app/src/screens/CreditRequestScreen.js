import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { X, AlertCircle } from 'lucide-react-native';
import { useAuthStore, creditosApi } from '@civiccore/sdk';

export default function CreditRequestScreen({ navigation }) {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('3'); // meses
  const [isSpecial, setIsSpecial] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simulación de cuota con 5% de interés mensual
  const interestRate = 0.05;
  const parsedAmount = parseFloat(amount) || 0;
  const parsedTerm = parseInt(term) || 1;
  const totalAmount = parsedAmount + (parsedAmount * interestRate * parsedTerm);
  const monthlyPayment = totalAmount / parsedTerm;

  const handleRequest = async () => {
    if (parsedAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await creditosApi.solicitar(user.id, {
        amount_requested: parsedAmount,
        currency: 'USD',
        term_months: parsedTerm,
        purpose: isSpecial ? reason : 'Crédito estándar',
        evaluation_data: { isSpecial }
      });
      Alert.alert('Éxito', 'Tu solicitud de crédito ha sido enviada para su revisión.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la solicitud de crédito.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Solicitar Crédito</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X color={COLORS.text} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Crédito Especial</Text>
              <Text style={styles.helperText}>Req. aprobación de asamblea</Text>
            </View>
            <Switch
              value={isSpecial}
              onValueChange={setIsSpecial}
              trackColor={{ false: COLORS.background, true: COLORS.success }}
              thumbColor={COLORS.text}
            />
          </View>
        </View>

        {isSpecial && (
          <View style={styles.alertBox}>
            <AlertCircle color={COLORS.accent} size={20} />
            <Text style={styles.alertText}>
              Los créditos especiales requieren exposición de motivos, pueden requerir requisitos adicionales y ser aprobados por votación de los socios.
            </Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Monto deseado (USD)</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <Text style={styles.limitText}>Tu límite preaprobado es $200.00</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Plazo (meses)</Text>
          <View style={styles.termContainer}>
            {['1', '3', '6', '12'].map((t) => (
              <TouchableOpacity 
                key={t} 
                style={[styles.termBtn, term === t && styles.termBtnActive]}
                onPress={() => setTerm(t)}
              >
                <Text style={[styles.termText, term === t && styles.termTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isSpecial && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Exposición de motivos</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              placeholder="¿Para qué necesitas este crédito especial?"
              placeholderTextColor={COLORS.textMuted}
              value={reason}
              onChangeText={setReason}
            />
          </View>
        )}

        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Resumen de Pago</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Interés estimado (5% mensual)</Text>
            <Text style={styles.summaryValue}>${(totalAmount - parsedAmount).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Cuota mensual aproximada</Text>
            <Text style={styles.summaryValueBold}>${monthlyPayment.toFixed(2)}</Text>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, (parsedAmount <= 0 || isSubmitting) && styles.submitBtnDisabled]}
          disabled={parsedAmount <= 0 || isSubmitting}
          onPress={handleRequest}
        >
          <Text style={styles.submitBtnText}>{isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.card,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  alertText: {
    color: COLORS.accent,
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyPrefix: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    paddingVertical: 15,
  },
  limitText: {
    color: COLORS.success,
    fontSize: 12,
    marginTop: 8,
  },
  termContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  termBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  termBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  termText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },
  termTextActive: {
    color: COLORS.background,
  },
  textArea: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 12,
    padding: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  summaryLabelBold: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryValueBold: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.card,
  },
  submitBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
  }
});
