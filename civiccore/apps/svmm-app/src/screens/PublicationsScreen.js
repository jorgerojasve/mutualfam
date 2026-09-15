import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Download, ExternalLink, Calendar } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

import { useAuthorship } from '../hooks/useAuthorship';

export default function PublicationsScreen() {
  const { documents, loading, error } = useAuthorship();

  // Map backend format to UI format
  const mappedDocs = documents.map(d => ({
    id: d.id.toString(),
    title: d.title,
    type: d.document_type || 'Documento',
    date: new Date(d.created_at).toLocaleDateString(),
    // In a real app we'd map over d.authorships to get the external names or member names
    authors: d.authorships && d.authorships.length > 0 
      ? d.authorships.map(a => a.external_name || `Member #${a.member_id}`).join(', ') 
      : 'No especificado'
  }));
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BookOpen color={COLORS.accent} size={28} />
        <Text style={styles.headerTitle}>Publicaciones y Actas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Repositorio oficial de la sociedad. Todas las actas, resoluciones y papers patrocinados quedan registrados aquí de forma inmutable.
        </Text>

        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{color: COLORS.text, textAlign: 'center', padding: 20}}>Cargando repositorio...</Text>
          ) : error ? (
            <Text style={{color: 'red', textAlign: 'center', padding: 20}}>Error: {error}</Text>
          ) : mappedDocs.length === 0 ? (
            <Text style={{color: COLORS.textMuted, textAlign: 'center', padding: 20}}>No hay documentos registrados.</Text>
          ) : mappedDocs.map(doc => (
            <View key={doc.id} style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{doc.type}</Text>
                </View>
                <View style={styles.dateContainer}>
                  <Calendar color={COLORS.textMuted} size={14} />
                  <Text style={styles.dateText}>{doc.date}</Text>
                </View>
              </View>
              
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.docAuthors}>Autores/Emisor: {doc.authors}</Text>
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Download color={COLORS.accent} size={18} />
                  <Text style={styles.actionBtnText}>Descargar PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnSecondary}>
                  <ExternalLink color={COLORS.textMuted} size={18} />
                  <Text style={styles.actionBtnSecondaryText}>Ver Hash</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 25,
  },
  listContainer: {
    gap: 15,
  },
  docCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 5,
  },
  docTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
    marginBottom: 8,
  },
  docAuthors: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: {
    color: COLORS.accent,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 13,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnSecondaryText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 13,
  }
});
