import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { OrgContext } from '../context/OrgContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function MutualHeader({ title }) {
  const { activeOrg, organizations, selectOrg } = useContext(OrgContext);
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (org) => {
    selectOrg(org);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <TouchableOpacity style={styles.orgSelector} onPress={() => setModalVisible(true)}>
        <Text style={styles.orgName}>{activeOrg ? activeOrg.name : 'Seleccionar Mutual'}</Text>
        <Ionicons name="chevron-down" size={16} color="#94a3b8" style={{marginLeft: 4}} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tus Mutuales</Text>
            <FlatList
              data={organizations}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.orgItem, activeOrg?.id === item.id && styles.activeOrgItem]} 
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.orgItemText, activeOrg?.id === item.id && styles.activeOrgItemText]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.manageButton} 
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('SelectMutual');
              }}
            >
              <Text style={styles.manageButtonText}>Gestionar Mutuales</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  orgSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  orgName: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 15,
  },
  orgItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#0f172a',
  },
  activeOrgItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  orgItemText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  activeOrgItemText: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  manageButton: {
    marginTop: 15,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  manageButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
  }
});
