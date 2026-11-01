import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../utils/theme';

/**
 * Estado vacío cuando no hay conexión de red al iniciar la pantalla o cargar datos.
 * Evita que el usuario piense que sus datos o préstamos fueron cancelados o eliminados.
 */
export function OfflineEmptyState({
  title = "Sin conexión de red",
  message = "No pudimos cargar los datos de las mutuales y préstamos. Tus datos están seguros y no se han eliminado. Por favor, intenta de nuevo cuando tengas conexión.",
  onRetry,
  loading = false,
  style,
}) {
  return (
    <View style={[styles.emptyContainer, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-offline-outline" size={54} color="#fbbf24" />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      <Text style={styles.message}>
        {message}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={[styles.retryButton, loading && styles.retryButtonDisabled]}
          onPress={onRetry}
          activeOpacity={0.8}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Reintentar conexión"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="reload-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.retryButtonText}>
            {loading ? "Reintentando..." : "Reintentar conexión"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Barra o cintillo de advertencia de sin conexión, útil cuando se muestran
 * datos cacheados o se detecta desconexión temporal.
 */
export function OfflineNotice({
  message = "Sin conexión de red · Intenta de nuevo cuando tengas conexión",
  onRetry,
  loading = false,
  style,
}) {
  return (
    <View style={[styles.bannerContainer, style]}>
      <Ionicons name="cloud-offline-outline" size={18} color="#fbbf24" style={{ marginRight: 8 }} />
      <Text style={styles.bannerText} numberOfLines={2}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.bannerRetryBtn}
          onPress={onRetry}
          activeOpacity={0.7}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fbbf24" />
          ) : (
            <Ionicons name="reload-outline" size={15} color="#fbbf24" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    marginVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent || '#3b82f6',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  retryButtonDisabled: {
    opacity: 0.65,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  bannerText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerRetryBtn: {
    padding: 6,
    marginLeft: 6,
  },
});

export default OfflineEmptyState;
