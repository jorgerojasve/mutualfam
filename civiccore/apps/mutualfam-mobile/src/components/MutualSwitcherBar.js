import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OrgContext } from '../context/OrgContext';

const WIDE_BREAKPOINT = 768;

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');
const roleLabel = (role) => (role === 'founder' ? 'Fundador' : 'Miembro');

/**
 * Barra global fija sobre las pestañas. El selector de mutual es contexto de
 * toda la app (no de una pestaña), por eso vive en el Tab.Navigator `header`
 * y no depende del título ni de los botones de cada pantalla.
 *
 * - Móvil: toda la barra es el área táctil (>= 48dp) y abre un bottom sheet.
 * - Pantallas anchas: el panel se muestra como tarjeta anclada arriba.
 */
export default function MutualSwitcherBar() {
  const { activeOrg, organizations, selectOrg } = useContext(OrgContext);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const [open, setOpen] = useState(false);

  const handleSelect = async (org) => {
    setOpen(false);
    if (org.id !== activeOrg?.id) await selectOrg(org);
  };

  const handleManage = () => {
    setOpen(false);
    navigation.navigate('SelectMutual');
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity
        style={styles.trigger}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Mutual activa: ${activeOrg?.name || 'ninguna'}. Toca para cambiar`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialOf(activeOrg?.name)}</Text>
        </View>
        <View style={styles.labels}>
          <Text style={styles.caption}>MUTUAL ACTIVA</Text>
          <Text style={styles.name} numberOfLines={1}>
            {activeOrg ? activeOrg.name : 'Seleccionar mutual'}
          </Text>
        </View>
        <Ionicons name="swap-vertical" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType={isWide ? 'fade' : 'slide'}
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          style={[styles.overlay, isWide ? styles.overlayWide : styles.overlayNarrow]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              isWide
                ? [styles.sheetWide, { marginTop: insets.top + 56 }]
                : [styles.sheetNarrow, { paddingBottom: insets.bottom + 16 }],
            ]}
            onPress={() => {}}
          >
            {!isWide && <View style={styles.handle} />}
            <Text style={styles.sheetTitle}>Cambiar de mutual</Text>
            <Text style={styles.sheetHint}>
              La mutual elegida se aplica a toda la app: préstamos, fondos y familia.
            </Text>

            <FlatList
              data={organizations}
              keyExtractor={(item) => item.id.toString()}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = activeOrg?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.row, selected && styles.rowActive]}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={[styles.avatar, styles.avatarSmall, !selected && styles.avatarMuted]}>
                      <Text style={styles.avatarText}>{initialOf(item.name)}</Text>
                    </View>
                    <View style={styles.rowLabels}>
                      <Text style={[styles.rowName, selected && styles.rowNameActive]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.rowRole}>{roleLabel(item.role)}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />}
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity style={styles.manage} onPress={handleManage} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
              <Text style={styles.manageText}>Crear, unirse o gestionar mutuales</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#0b1220',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmall: { width: 38, height: 38 },
  avatarMuted: { backgroundColor: '#475569' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  labels: { flex: 1, marginHorizontal: 12 },
  caption: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  name: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayNarrow: { justifyContent: 'flex-end' },
  overlayWide: { alignItems: 'flex-start', paddingLeft: 12 },
  sheet: { backgroundColor: '#1e293b' },
  sheetNarrow: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '70%',
  },
  sheetWide: {
    width: 420,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  sheetTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  sheetHint: { color: '#94a3b8', fontSize: 13, marginTop: 4, marginBottom: 14 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowActive: { borderColor: '#3b82f6' },
  rowLabels: { flex: 1, marginHorizontal: 12 },
  rowName: { color: '#cbd5e1', fontSize: 16 },
  rowNameActive: { color: '#f8fafc', fontWeight: '700' },
  rowRole: { color: '#64748b', fontSize: 12, marginTop: 2 },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  manageText: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },
});
