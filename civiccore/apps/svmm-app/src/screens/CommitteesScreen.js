import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { committeesApi } from '@civiccore/sdk';
import { Network, Layout, Users } from 'lucide-react-native';

const CommitteesScreen = () => {
  const [committees, setCommittees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCommittees();
  }, []);

  const fetchCommittees = async () => {
    try {
      setIsLoading(true);
      const data = await committeesApi.list();
      setCommittees(data);
    } catch (error) {
      console.error("Error fetching committees", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Layout size={24} color="#3b82f6" />
        </View>
        {item.is_active && <Text style={styles.badge}>Activo</Text>}
      </View>
      <Text style={styles.committeeTitle}>{item.name}</Text>
      <Text style={styles.committeeArea}>{item.area || 'Área General'}</Text>
      
      <View style={styles.infoContainer}>
        <Users size={16} color="#9ca3af" />
        <Text style={styles.infoText}>{item.members ? item.members.length : 0} Miembros</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Comités Especializados</Text>
      <Text style={styles.headerSubtitle}>Grupos de trabajo con autoridad delegada.</Text>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
      ) : committees.length === 0 ? (
        <View style={styles.emptyState}>
          <Network size={48} color="#4b5563" />
          <Text style={styles.emptyTitle}>No hay comités activos</Text>
          <Text style={styles.emptySubtitle}>Puedes proponer la creación de un nuevo comité desde el menú principal.</Text>
        </View>
      ) : (
        <FlatList
          data={committees}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  committeeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  committeeArea: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  infoText: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});

export default CommitteesScreen;
