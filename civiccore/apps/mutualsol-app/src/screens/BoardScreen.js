import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { boardApi } from '@civiccore/sdk';
import { Users, Clock } from 'lucide-react-native';

const BoardScreen = () => {
  const [boardPositions, setBoardPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    try {
      setIsLoading(true);
      const data = await boardApi.getCurrentBoard();
      setBoardPositions(data);
    } catch (error) {
      console.error("Error fetching board", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Users size={24} color="#34d399" />
        </View>
        {item.active && <Text style={styles.badge}>Activo</Text>}
      </View>
      <Text style={styles.positionTitle}>{item.position}</Text>
      <Text style={styles.memberId}>ID Miembro: <Text style={styles.memberIdValue}>#{item.member_id}</Text></Text>
      
      <View style={styles.dateContainer}>
        <Clock size={14} color="#9ca3af" />
        <Text style={styles.dateText}>Elegido: {new Date(item.elected_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.dateContainer}>
        <Clock size={14} color="transparent" />
        <Text style={styles.dateText}>Expira: {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'Indefinido'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Junta Directiva</Text>
      <Text style={styles.headerSubtitle}>Miembros electos para la coordinación de la mutual.</Text>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#34d399" style={{ marginTop: 40 }} />
      ) : boardPositions.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={48} color="#4b5563" />
          <Text style={styles.emptyTitle}>No hay una junta activa</Text>
          <Text style={styles.emptySubtitle}>La asamblea debe convocar elecciones.</Text>
        </View>
      ) : (
        <FlatList
          data={boardPositions}
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
    borderLeftColor: '#34d399',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    padding: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 8,
  },
  badge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    color: '#34d399',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  positionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  memberId: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  memberIdValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
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
  }
});

export default BoardScreen;
