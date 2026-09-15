import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Search, Award, Mail, ChevronRight, Filter } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

import { useMembership } from '../hooks/useMembership';

export default function DirectoryScreen() {
  const { members, loading, error } = useMembership();
  const [search, setSearch] = useState('');

  // Map backend format to UI format
  const mappedMembers = members.map(m => ({
    id: m.id.toString(),
    name: `${m.first_name} ${m.last_name}`,
    role: m.role,
    department: m.extra_fields?.department || 'General',
    status: m.status,
    joined: new Date(m.created_at).getFullYear().toString()
  }));

  const filteredMembers = mappedMembers.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.department.toLowerCase().includes(search.toLowerCase())
  );

  const renderMemberCard = (member) => (
    <TouchableOpacity key={member.id} style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.avatarText}>{member.name.charAt(0)}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{member.role} • {member.department}</Text>
        <View style={styles.badgeRow}>
          {member.status === 'active' ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Text style={[styles.badgeText, { color: COLORS.success }]}>Activo</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: 'rgba(245,166,35,0.1)' }]}>
              <Text style={[styles.badgeText, { color: COLORS.accent }]}>Pendiente</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: 'rgba(148,163,184,0.1)' }]}>
            <Text style={styles.badgeTextMuted}>Desde {member.joined}</Text>
          </View>
        </View>
      </View>
      <ChevronRight color={COLORS.border} size={24} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Users color={COLORS.accent} size={28} />
        <Text style={styles.headerTitle}>Directorio Académico</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search color={COLORS.textMuted} size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar investigadores o departamentos..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.filterBtn}>
          <Filter color={COLORS.text} size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{color: COLORS.text, marginTop: 10}}>Cargando directorio...</Text>
        </View>
      ) : error ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{color: COLORS.error}}>Error: {error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{members.length}</Text>
              <Text style={styles.statLabel}>Total Miembros</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {members.filter(m => m.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Activos</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Investigadores</Text>
          {filteredMembers.map(renderMemberCard)}
        </ScrollView>
      )}
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
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 35,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    height: 46,
    borderRadius: 12,
    paddingLeft: 45,
    paddingRight: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtn: {
    backgroundColor: COLORS.card,
    height: 46,
    width: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    backgroundColor: 'rgba(56,189,248,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 16,
    padding: 15,
    width: '48%',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  memberRole: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextMuted: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  }
});
