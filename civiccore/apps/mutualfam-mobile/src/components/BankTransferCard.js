import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { VENEZUELAN_BANKS, getBankLabel, formatAccountNumber, cleanAccountNumber } from '../utils/banks';

export default function BankTransferCard({
  data,
  montoBs,
  tasaLabel,
  recipientName,
  banks = VENEZUELAN_BANKS,
}) {
  const [copiedField, setCopiedField] = useState(null);

  if (!data || typeof data !== 'object') {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>No se encontraron datos de transferencia configurados.</Text>
      </View>
    );
  }

  const getPrefix = (tipo) => {
    if (!tipo || tipo === 'Persona' || tipo === 'V') return 'V';
    if (tipo === 'Extranjero' || tipo === 'E') return 'E';
    if (tipo === 'Comercio' || tipo === 'J') return 'J';
    if (tipo === 'Comuna' || tipo === 'G') return 'G';
    return tipo[0] || 'V';
  };

  const docPrefix = getPrefix(data.tipo_doc);
  const safeDoc = data.cedula ? `${docPrefix}-${data.cedula}` : '';
  const rawAccount = cleanAccountNumber(data.numero_cuenta);
  const formattedAccount = formatAccountNumber(rawAccount);
  const bankLabel = getBankLabel(data.banco, banks);
  const tipoCuenta = data.tipo_cuenta || 'Corriente';

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

  const copyAll = async () => {
    try {
      const lines = [
        'Datos de Transferencia Bancaria:',
        `• Banco: ${bankLabel}`,
        `• Cuenta: ${rawAccount}`,
        `• Tipo: ${tipoCuenta}`,
      ];
      if (data.titular) lines.push(`• Titular: ${data.titular}`);
      if (safeDoc) lines.push(`• Documento / RIF: ${safeDoc}`);
      if (data.email) lines.push(`• Correo: ${data.email}`);
      if (data.telefono) lines.push(`• Teléfono: ${data.telefono}`);
      if (montoBs) lines.push(`• Monto: Bs. ${montoBs}`);

      await Clipboard.setStringAsync(lines.join('\n'));
      setCopiedField('all');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying all transfer data', e);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>🏛️ Datos de Transferencia Bancaria</Text>
          {recipientName ? (
            <Text style={styles.cardSubtitle}>Destinatario: {recipientName}</Text>
          ) : null}
        </View>
        <View style={styles.accountTypeBadge}>
          <Text style={styles.accountTypeBadgeText}>{tipoCuenta}</Text>
        </View>
      </View>

      {/* Monto a transferir en Bs */}
      {montoBs ? (
        <TouchableOpacity
          style={styles.copyDataRow}
          onPress={() => copyField('monto', montoBs)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.copyDataLabel}>
              Monto a transferir {tasaLabel ? `(${tasaLabel})` : ''}
            </Text>
            <Text style={[styles.copyDataValue, { color: '#10b981', fontSize: 16 }]}>
              Bs {montoBs}
            </Text>
          </View>
          <Text style={styles.copyIcon}>{copiedField === 'monto' ? '✓' : '📋'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Banco Destino */}
      <TouchableOpacity
        style={styles.copyDataRow}
        onPress={() => copyField('banco', bankLabel)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.copyDataLabel}>Banco Destino</Text>
          <Text style={styles.copyDataValue}>{bankLabel}</Text>
        </View>
        <Text style={styles.copyIcon}>{copiedField === 'banco' ? '✓' : '📋'}</Text>
      </TouchableOpacity>

      {/* Número de Cuenta (20 dígitos) */}
      <TouchableOpacity
        style={[styles.copyDataRow, styles.accountRow]}
        onPress={() => copyField('cuenta', rawAccount)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.copyDataLabel}>Número de Cuenta (Toca para copiar sin espacios)</Text>
          <Text style={[styles.copyDataValue, styles.accountNumberText]}>
            {formattedAccount || rawAccount}
          </Text>
        </View>
        <Text style={styles.copyIcon}>{copiedField === 'cuenta' ? '✓' : '📋'}</Text>
      </TouchableOpacity>

      {/* Titular de la cuenta */}
      {data.titular ? (
        <TouchableOpacity
          style={styles.copyDataRow}
          onPress={() => copyField('titular', data.titular)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.copyDataLabel}>Titular de la Cuenta</Text>
            <Text style={styles.copyDataValue}>{data.titular}</Text>
          </View>
          <Text style={styles.copyIcon}>{copiedField === 'titular' ? '✓' : '📋'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Cédula o RIF */}
      {safeDoc ? (
        <TouchableOpacity
          style={styles.copyDataRow}
          onPress={() => copyField('doc', safeDoc)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.copyDataLabel}>Documento / RIF</Text>
            <Text style={styles.copyDataValue}>{safeDoc}</Text>
          </View>
          <Text style={styles.copyIcon}>{copiedField === 'doc' ? '✓' : '📋'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Correo Electrónico (si fue configurado) */}
      {data.email ? (
        <TouchableOpacity
          style={styles.copyDataRow}
          onPress={() => copyField('email', data.email)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.copyDataLabel}>Correo de Confirmación</Text>
            <Text style={[styles.copyDataValue, { fontSize: 14 }]}>{data.email}</Text>
          </View>
          <Text style={styles.copyIcon}>{copiedField === 'email' ? '✓' : '📋'}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Botón Destacado: Copiar Todos los Datos */}
      <TouchableOpacity
        style={styles.copyAllButton}
        onPress={copyAll}
        activeOpacity={0.8}
      >
        <Text style={styles.copyAllButtonText}>
          {copiedField === 'all' ? '✅ ¡Todos los datos copiados!' : '📋 Copiar todo para el banco'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  accountTypeBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  accountTypeBadgeText: {
    color: '#93c5fd',
    fontSize: 11,
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
  accountRow: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  copyDataLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  copyDataValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  accountNumberText: {
    letterSpacing: 1,
    fontSize: 15,
    color: '#38bdf8',
  },
  copyIcon: {
    fontSize: 18,
    opacity: 0.9,
    color: '#38bdf8',
    marginLeft: 8,
  },
  copyAllButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  copyAllButtonText: {
    color: '#93c5fd',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
});

