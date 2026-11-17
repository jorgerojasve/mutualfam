import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const CASH_DENOMINATIONS = [100, 50, 20, 10, 5, 1];

export default function CashPayrollInput({
  targetAmount = 0,
  payroll = {},
  onPayrollChange,
  serials = '',
  onSerialsChange,
  deliveryNote = '',
  onDeliveryNoteChange,
}) {
  const currentPayroll = payroll || {};

  const handleDelta = (den, delta) => {
    const current = parseInt(currentPayroll[den], 10) || 0;
    const nextVal = Math.max(0, current + delta);
    const updated = {
      ...currentPayroll,
      [den]: nextVal,
    };
    if (onPayrollChange) onPayrollChange(updated);
  };

  const handleClear = () => {
    const cleared = {};
    CASH_DENOMINATIONS.forEach((d) => {
      cleared[d] = 0;
    });
    if (onPayrollChange) onPayrollChange(cleared);
  };

  const totalCalculated = CASH_DENOMINATIONS.reduce((sum, den) => {
    const qty = parseInt(currentPayroll[den], 10) || 0;
    return sum + (qty * den);
  }, 0);

  const hasAnyBills = totalCalculated > 0;
  const numTarget = parseFloat(targetAmount) || 0;
  const diff = numTarget > 0 ? Number((totalCalculated - numTarget).toFixed(2)) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calculator-outline" size={17} color="#10b981" />
            <Text style={styles.sectionTitle}>Nómina / Desglose de Billetes</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Indica la cantidad de billetes de cada denominación que vas a entregar.
          </Text>
        </View>
        {hasAnyBills && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.clearBtnText}>Limpiar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid de Denominaciones */}
      <View style={styles.grid}>
        {CASH_DENOMINATIONS.map((den) => {
          const count = parseInt(currentPayroll[den], 10) || 0;
          const subtotal = count * den;
          const isActive = count > 0;

          return (
            <View key={den} style={[styles.denCard, isActive && styles.denCardActive]}>
              <View style={styles.denHeader}>
                <Text style={[styles.denTitle, isActive && styles.denTitleActive]}>${den}</Text>
                {isActive && (
                  <Text style={styles.denSubtotal}>= ${subtotal}</Text>
                )}
              </View>

              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={[styles.btnCounter, count === 0 && styles.btnCounterDisabled]}
                  onPress={() => handleDelta(den, -1)}
                  disabled={count === 0}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnCounterText, count === 0 && styles.btnCounterTextDisabled]}>−</Text>
                </TouchableOpacity>

                <View style={styles.countBadge}>
                  <Text style={[styles.countText, isActive && styles.countTextActive]}>
                    {count}
                  </Text>
                  <Text style={styles.countUnit}>{count === 1 ? 'billete' : 'billetes'}</Text>
                </View>

                <TouchableOpacity
                  style={styles.btnCounter}
                  onPress={() => handleDelta(den, 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnCounterText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Resumen y comparación en vivo con la meta */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryLabel}>Total en Billetes Seleccionados:</Text>
          <Text style={styles.summaryTotal}>${totalCalculated} USD</Text>
        </View>

        {numTarget > 0 && (
          <View style={styles.feedbackContainer}>
            {diff === 0 && totalCalculated > 0 ? (
              <View style={[styles.feedbackBadge, styles.feedbackMatch]}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.feedbackMatchText}>
                  ¡Cuadre exacto! La nómina coincide con los ${numTarget} USD acordados.
                </Text>
              </View>
            ) : diff < 0 ? (
              <View style={[styles.feedbackBadge, styles.feedbackMissing]}>
                <Ionicons name="alert-circle-outline" size={16} color="#f59e0b" />
                <Text style={styles.feedbackMissingText}>
                  Faltan ${(Math.abs(diff)).toFixed(2)} USD para completar el total prometido (${totalCalculated} de ${numTarget}).
                </Text>
              </View>
            ) : diff > 0 ? (
              <View style={[styles.feedbackBadge, styles.feedbackExceed]}>
                <Ionicons name="information-circle-outline" size={16} color="#38bdf8" />
                <Text style={styles.feedbackExceedText}>
                  La nómina suma ${totalCalculated} USD (supera por ${diff.toFixed(2)} USD los ${numTarget} acordados).
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Seriales de los billetes (Opcional) */}
      <View style={styles.inputSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <Ionicons name="barcode-outline" size={15} color="#94a3b8" />
          <Text style={styles.inputLabel}>Serial(es) de los billetes (Opcional para respaldo)</Text>
        </View>
        <TextInput
          style={styles.textInput}
          value={serials}
          onChangeText={onSerialsChange}
          placeholder="Ej: MB12345678A, LF98765432B"
          placeholderTextColor="#64748b"
          autoCapitalize="characters"
        />
        <Text style={styles.helpText}>
          🛡️ Recomendado en Venezuela: registrar los seriales protege a ambas partes contra billetes sospechosos o reclamos posteriores.
        </Text>
      </View>

      {/* Nota / Lugar de entrega */}
      <View style={styles.inputSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color="#94a3b8" />
          <Text style={styles.inputLabel}>Lugar / Nota de Entrega (Opcional)</Text>
        </View>
        <TextInput
          style={styles.textInput}
          value={deliveryNote}
          onChangeText={onDeliveryNoteChange}
          placeholder="Ej: Entregado en mano en la oficina / acordado para hoy a las 3:00 pm"
          placeholderTextColor="#64748b"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  denCard: {
    width: '48%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  denCardActive: {
    backgroundColor: 'rgba(6, 78, 59, 0.28)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  denHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  denTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  denTitleActive: {
    color: '#10b981',
  },
  denSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6ee7b7',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 4,
  },
  btnCounter: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCounterDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  btnCounterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34d399',
    lineHeight: 20,
  },
  btnCounterTextDisabled: {
    color: '#64748b',
  },
  countBadge: {
    alignItems: 'center',
    minWidth: 46,
  },
  countText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  countTextActive: {
    color: '#f8fafc',
  },
  countUnit: {
    fontSize: 9,
    color: '#64748b',
  },
  summaryBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 12,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryTotal: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
  },
  feedbackMatch: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  feedbackMatchText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  feedbackMissing: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  feedbackMissingText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  feedbackExceed: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  feedbackExceedText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputSection: {
    marginBottom: 12,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13.5,
  },
  helpText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

