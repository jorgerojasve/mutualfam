import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useBetaPhase, showBetaInfoAlert } from '../utils/beta';

/**
 * Insignia visual (Badge/Chip) de Versión Beta.
 * Se oculta automáticamente cuando la aplicación se encuentra en fase Estable.
 * Al tocarla, despliega un diálogo informativo con opción para contactar a soporte.
 */
export default function BetaBadge({ userEmail = '', orgName = '', size = 'normal', style }) {
  const { isBeta, phaseLabel } = useBetaPhase();

  if (!isBeta) return null;

  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      style={[
        styles.badge,
        isSmall ? styles.badgeSmall : styles.badgeNormal,
        style,
      ]}
      activeOpacity={0.7}
      onPress={() => showBetaInfoAlert(userEmail, orgName)}
      accessibilityRole="button"
      accessibilityLabel={`Fase ${phaseLabel}. Toca para más información o enviar comentarios`}
    >
      <View style={[styles.dot, isSmall ? styles.dotSmall : styles.dotNormal]} />
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textNormal]}>
        {phaseLabel.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.18)', // Indigo suave
    borderColor: 'rgba(129, 140, 248, 0.5)',
    borderWidth: 1,
    borderRadius: 12,
  },
  badgeNormal: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: {
    backgroundColor: '#818cf8',
    borderRadius: 4,
  },
  dotNormal: {
    width: 6,
    height: 6,
    marginRight: 5,
  },
  dotSmall: {
    width: 5,
    height: 5,
    marginRight: 4,
  },
  text: {
    color: '#a5b4fc',
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  textNormal: {
    fontSize: 11,
  },
  textSmall: {
    fontSize: 10,
  },
});
