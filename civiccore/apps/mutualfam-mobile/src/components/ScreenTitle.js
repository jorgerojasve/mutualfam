import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Título propio de cada pestaña. Ya no incluye el selector de mutual
 * (ahora global en MutualSwitcherBar); `right` permite una acción local.
 */
export default function ScreenTitle({ title, right }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  right: { marginLeft: 12 },
});
