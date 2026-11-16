import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function CashDeliveryCard({
  data,
  montoUsd,
  recipientName,
}) {
  const [copiedField, setCopiedField] = useState(null);

  if (!data || typeof data !== 'object') {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>No se encontraron datos de entrega en efectivo configurados.</Text>
      </View>
    );
  }

  const telefono = (data.telefono || '').trim();
  const lugar = (data.lugar || data.zona_entrega || '').trim();
  const horario = (data.horario || '').trim();
  const condiciones = Array.isArray(data.condiciones)
    ? data.condiciones
    : (data.condiciones ? [String(data.condiciones)] : []);
  const notas = (data.notas || '').trim();

  const cleanPhoneDigits = telefono.replace(/\D/g, '');
  let intlPhone = cleanPhoneDigits;
  if (cleanPhoneDigits.startsWith('04') || cleanPhoneDigits.startsWith('02')) {
    intlPhone = '58' + cleanPhoneDigits.slice(1);
  } else if (!cleanPhoneDigits.startsWith('58') && cleanPhoneDigits.length === 10) {
    intlPhone = '58' + cleanPhoneDigits;
  }

  const copyField = async (fieldKey, value) => {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(String(value));
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying to clipboard', e);
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!intlPhone) {
      Alert.alert('Teléfono no disponible', 'No hay un número de teléfono configurado.');
      return;
    }
    const greetingMsg = encodeURIComponent(
      `Hola ${recipientName ? recipientName + ', ' : ''}te contacto desde Mutual Familiar para coordinar la entrega en efectivo${montoUsd ? ' de $' + montoUsd + ' USD' : ''}.`
    );
    const waUrl = `https://wa.me/${intlPhone}?text=${greetingMsg}`;
    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(waUrl).catch(() => {
          copyField('tel', telefono);
          Alert.alert('Número Copiado', `No se pudo abrir WhatsApp automáticamente. Se copió el número ${telefono} al portapapeles.`);
        });
      }
    } catch (err) {
      copyField('tel', telefono);
      Alert.alert('Número Copiado', `Se copió el teléfono ${telefono} al portapapeles.`);
    }
  };

  const handleCallPhone = async () => {
    if (!telefono) return;
    const callUrl = `tel:${telefono}`;
    try {
      await Linking.openURL(callUrl);
    } catch (e) {
      copyField('tel', telefono);
      Alert.alert('Número Copiado', `Se copió el teléfono ${telefono} al portapapeles.`);
    }
  };

  const copyAll = async () => {
    try {
      const lines = [
        '💵 Datos para Entrega de Efectivo USD:',
      ];
      if (recipientName) lines.push(`• Receptor: ${recipientName}`);
      if (montoUsd) lines.push(`• Monto: $${montoUsd} USD`);
      if (telefono) lines.push(`• Teléfono / WhatsApp: ${telefono}`);
      if (lugar) lines.push(`• Lugar / Zona: ${lugar}`);
      if (horario) lines.push(`• Horario de preferencia: ${horario}`);
      if (condiciones.length > 0) lines.push(`• Condiciones de billetes: ${condiciones.join(', ')}`);
      if (notas) lines.push(`• Notas adicionales: ${notas}`);

      await Clipboard.setStringAsync(lines.join('\n'));
      setCopiedField('all');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying cash delivery info', e);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cash-outline" size={18} color="#10b981" />
            <Text style={styles.cardTitle}>Coordinación de Entrega en Efectivo USD</Text>
          </View>
          {recipientName ? (
            <Text style={styles.cardSubtitle}>Receptor: {recipientName}</Text>
          ) : null}
        </View>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyBadgeText}>USD Físico</Text>
        </View>
      </View>

      {/* Monto a entregar en USD */}
      {montoUsd ? (
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Monto a entregar en mano:</Text>
          <Text style={styles.amountValue}>${montoUsd} USD</Text>
        </View>
      ) : null}

      {/* Teléfono y acciones rápidas (WhatsApp / Llamar) */}
      {telefono ? (
        <View style={styles.phoneSection}>
          <View style={styles.phoneInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.copyDataLabel}>Teléfono para coordinar entrega</Text>
              <Text style={styles.phoneText}>{telefono}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyIconButton}
              onPress={() => copyField('tel', telefono)}
              activeOpacity={0.7}
            >
              <Text style={styles.copyIcon}>{copiedField === 'tel' ? '✓' : '📋'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.phoneActionsRow}>
            <TouchableOpacity
              style={styles.actionBtnWhatsApp}
              onPress={handleOpenWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#ffffff" />
              <Text style={styles.actionBtnWhatsAppText}>Abrir WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnCall}
              onPress={handleCallPhone}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={15} color="#38bdf8" />
              <Text style={styles.actionBtnCallText}>Llamar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Lugar de preferencia */}
      {lugar ? (
        <TouchableOpacity
          style={styles.copyDataRow}
          onPress={() => copyField('lugar', lugar)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={13} color="#94a3b8" />
              <Text style={styles.copyDataLabel}>Lugar / Zona de Entrega</Text>
            </View>
            <Text style={styles.copyDataValue}>{lugar}</Text>
          </View>
          <Text style={styles.copyIcon}>{copiedField === 'lugar' ? '✓' : '📋'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Horario de preferencia */}
      {horario ? (
        <View style={styles.infoRowStatic}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={13} color="#94a3b8" />
              <Text style={styles.copyDataLabel}>Horario / Días Disponibles</Text>
            </View>
            <Text style={styles.copyDataValue}>{horario}</Text>
          </View>
        </View>
      ) : null}

      {/* Condiciones de los billetes */}
      {condiciones.length > 0 && (
        <View style={styles.conditionsBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#f59e0b" />
            <Text style={styles.conditionsTitle}>Condición de billetes requerida:</Text>
          </View>
          {condiciones.map((cond, idx) => (
            <Text key={idx} style={styles.conditionItem}>• {cond}</Text>
          ))}
        </View>
      )}

      {/* Notas adicionales */}
      {notas ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Nota del receptor:</Text>
          <Text style={styles.notesText}>{notas}</Text>
        </View>
      ) : null}

      {/* Botón Destacado: Copiar Todos los Datos */}
      <TouchableOpacity
        style={styles.copyAllButton}
        onPress={copyAll}
        activeOpacity={0.8}
      >
        <Text style={styles.copyAllButtonText}>
          {copiedField === 'all' ? '✅ ¡Datos de entrega copiados!' : '📋 Copiar datos de coordinación'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(6, 78, 59, 0.22)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    color: '#34d399',
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  currencyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  currencyBadgeText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
  },
  amountBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  amountLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  amountValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  phoneSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  phoneInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  phoneActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionBtnWhatsAppText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionBtnCallText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '700',
  },
  copyDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoRowStatic: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  copyDataLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  copyDataValue: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '600',
  },
  copyIcon: {
    fontSize: 16,
    opacity: 0.9,
    color: '#34d399',
    marginLeft: 8,
  },
  copyIconButton: {
    padding: 4,
  },
  conditionsBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  conditionsTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  conditionItem: {
    color: '#fef3c7',
    fontSize: 12,
    marginLeft: 4,
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  notesLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    color: '#cbd5e1',
    fontSize: 12.5,
    marginTop: 2,
    fontStyle: 'italic',
  },
  copyAllButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  copyAllButtonText: {
    color: '#6ee7b7',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
});
