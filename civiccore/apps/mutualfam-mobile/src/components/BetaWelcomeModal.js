import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBetaPhase, hasSeenBetaWelcome, markBetaWelcomeSeen } from '../utils/beta';
import { openSupportEmail } from '../utils/support';
import theme from '../utils/theme';

/**
 * Modal de Bienvenida para la Versión Beta (Onboarding Único).
 * Solo se muestra una vez por dispositivo mientras la app esté en fase Beta.
 * Se desactiva y no se muestra si la aplicación está configurada en fase Estable.
 */
export default function BetaWelcomeModal() {
  const { isBeta, welcomeTitle, welcomeMessage } = useBetaPhase();
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  useEffect(() => {
    let isMounted = true;
    const checkWelcome = async () => {
      if (!isBeta) {
        if (isMounted) setVisible(false);
        return;
      }
      const seen = await hasSeenBetaWelcome();
      if (!seen && isMounted) {
        setVisible(true);
      }
    };
    checkWelcome();
    return () => {
      isMounted = false;
    };
  }, [isBeta]);

  const handleDismiss = async () => {
    await markBetaWelcomeSeen();
    setVisible(false);
  };

  const handleSupport = () => {
    openSupportEmail({
      subject: 'Dudas o Feedback - Bienvenida Beta Mutual Familiar',
      contextNote: 'Iniciado desde el modal de bienvenida a la versión Beta.',
    });
  };

  if (!visible || !isBeta) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.card, isWide && styles.cardWide]}>
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
            {/* Cabecera con Icono y Pill */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={28} color="#818cf8" />
              </View>
              <View style={styles.pillContainer}>
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>FASE 5 • PRUEBAS ACTIVAS</Text>
              </View>
              <Text style={styles.title}>{welcomeTitle}</Text>
            </View>

            {/* Mensaje Principal */}
            <Text style={styles.message}>
              {welcomeMessage ||
                'Estás utilizando la versión preliminar de Mutual Familiar. Gracias por ser parte del grupo de familias pioneras que nos ayuda a validar la plataforma con su uso y sugerencias.'}
            </Text>

            {/* Puntos Destacados */}
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="people-outline" size={20} color="#38bdf8" style={styles.featureIcon} />
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Uso Real en Familia</Text>
                  <Text style={styles.featureDesc}>
                    Préstamos, fondos y cuotas en funcionamiento para la dinámica familiar.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="chatbubbles-outline" size={20} color="#34d399" style={styles.featureIcon} />
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Canal de Soporte Directo</Text>
                  <Text style={styles.featureDesc}>
                    Comunícate en cualquier momento vía email ante cualquier duda o sugerencia.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#fbbf24" style={styles.featureIcon} />
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Hacia la Versión Estable</Text>
                  <Text style={styles.featureDesc}>
                    Tus reportes nos permiten estabilizar y afinar el sistema antes del lanzamiento oficial.
                  </Text>
                </View>
              </View>
            </View>

            {/* Botones de Acción */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.8}
                onPress={handleDismiss}
              >
                <Text style={styles.primaryButtonText}>¡Entendido, Comenzar!</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={handleSupport}
              >
                <Ionicons name="mail-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>¿Dudas o problemas? Contactar Soporte</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: theme.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  cardWide: {
    maxWidth: 460,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    marginBottom: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
    marginRight: 6,
  },
  pillText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  featureIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: '#94a3b8',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4f46e5', // Indigo 600
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
