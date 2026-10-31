import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../utils/theme';

export default function UpdateModal({ updateInfo, onDismiss }) {
  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const {
    isMandatory,
    currentVersion,
    latestVersion,
    releaseNotes,
    downloadUrl,
  } = updateInfo;

  const handleUpdate = async () => {
    try {
      if (downloadUrl) {
        await Linking.openURL(downloadUrl);
      }
    } catch (err) {
      console.warn('Error al abrir URL de descarga:', err);
    }
  };

  return (
    <Modal
      visible={Boolean(updateInfo.hasUpdate)}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isMandatory && onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Badge superior */}
          <View
            style={[
              styles.badge,
              isMandatory ? styles.badgeMandatory : styles.badgeOptional,
            ]}
          >
            <Ionicons
              name={isMandatory ? 'alert-circle' : 'sparkles'}
              size={16}
              color={isMandatory ? '#ef4444' : '#3b82f6'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.badgeText,
                { color: isMandatory ? '#fca5a5' : '#93c5fd' },
              ]}
            >
              {isMandatory
                ? 'Actualización Obligatoria'
                : 'Nueva Versión Disponible'}
            </Text>
          </View>

          {/* Título */}
          <Text style={styles.title}>
            {isMandatory
              ? 'Actualización Requerida'
              : '¡Nueva Versión Lista!'}
          </Text>

          {/* Indicador de Versiones */}
          <View style={styles.versionRow}>
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>Actual</Text>
              <Text style={styles.versionValue}>v{currentVersion}</Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#64748b"
              style={{ marginHorizontal: 8 }}
            />

            <View style={[styles.versionBox, styles.versionBoxNew]}>
              <Text style={[styles.versionLabel, { color: '#60a5fa' }]}>Nueva</Text>
              <Text style={[styles.versionValue, { color: '#93c5fd' }]}>
                v{latestVersion}
              </Text>
            </View>
          </View>

          {/* Mensaje descriptivo */}
          <Text style={styles.description}>
            {isMandatory
              ? 'Para garantizar la seguridad, compatibilidad y correcto funcionamiento de Mutual Familiar, es necesario actualizar a la última versión.'
              : 'Hay una nueva versión disponible con mejoras de estabilidad y nuevas características.'}
          </Text>

          {/* Notas de la versión (si existen) */}
          {releaseNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesHeader}>Novedades de esta versión:</Text>
              <ScrollView
                style={styles.notesScroll}
                contentContainerStyle={{ paddingVertical: 4 }}
                nestedScrollEnabled
              >
                <Text style={styles.notesText}>{releaseNotes}</Text>
              </ScrollView>
            </View>
          ) : null}

          {/* Acciones */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isMandatory ? styles.primaryButtonMandatory : styles.primaryButtonOptional,
              ]}
              onPress={handleUpdate}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cloud-download-outline"
                size={18}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryButtonText}>Descargar e Instalar</Text>
            </TouchableOpacity>

            {!isMandatory && onDismiss ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Más tarde</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.cardBg,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeOptional: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  badgeMandatory: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 14,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  versionBox: {
    flex: 1,
    backgroundColor: theme.screenBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  versionBoxNew: {
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  versionLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  versionValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  description: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  notesContainer: {
    backgroundColor: theme.screenBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  notesHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  notesScroll: {
    maxHeight: 110,
  },
  notesText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  primaryButtonOptional: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonMandatory: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
