import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Settings, Users, Info, ChevronDown, Check, AlertCircle } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { gobernanzaApi, configApi } from '@civiccore/sdk';

export default function CreateProposalScreen({ navigation }) {
  const [proposalType, setProposalType] = useState('standard');
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variable, setVariable] = useState('');
  const [newValue, setNewValue] = useState('');
  
  // Modals
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false); // For variables
  const [valueModalVisible, setValueModalVisible] = useState(false);
  
  const PROPOSAL_TYPES = [
    { id: 'standard', label: 'Estándar', desc: 'Propuesta que requiere acción humana o debate.' },
    { id: 'automatic', label: 'Implementación Automática', desc: 'Modifica parámetros del sistema al aprobarse.' },
    { id: 'expulsion', label: 'Expulsión de Miembro', desc: 'Propone remover a un miembro por faltas graves.' },
    { id: 'division', label: 'División Organizacional', desc: 'Propone dividir la mutual en múltiples fondos.' },
    { id: 'fusion', label: 'Fusión Organizacional', desc: 'Propone fusionarse con otra organización.' },
    { id: 'board_election', label: 'Elección de Junta (Plancha)', desc: 'Postular una plancha directiva.' },
    { id: 'committee_create', label: 'Creación de Comité', desc: 'Proponer un nuevo comité especializado.' }
  ];
  
  const CATEGORIES = [
    { id: 'general', label: 'Propuesta General' },
    { id: 'configuracion', label: 'Cambio de Configuración' },
    { id: 'financiamiento', label: 'Solicitud de Financiamiento' },
    { id: 'automatica', label: 'Implementación Automática' },
    { id: 'humana', label: 'Acción Humana Operativa' }
  ];
  
  const PREDEFINED_VALUES = {
    'SISTEMA_GOBERNANZA': [
      { id: 'DOS_FASES', label: 'Dos Fases (Debate + Referendo)' },
      { id: 'UNA_FASE_TIEMPO', label: 'Una Fase (Con Límite de Tiempo)' },
      { id: 'UNA_FASE_MANUAL', label: 'Una Fase (Cierre Manual)' }
    ],
    'COMENTARIOS_EN_REFERENDO': [
      { id: 'true', label: 'Sí, permitir comentarios' },
      { id: 'false', label: 'No, deshabilitar comentarios' }
    ]
  };
  
  const [configVariables, setConfigVariables] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Coalescence states
  const [similarProposals, setSimilarProposals] = useState([]);
  const [showSimilarityModal, setShowSimilarityModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const vars = await configApi.getVariables();
      setConfigVariables(vars);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleInitialSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Error', 'Por favor llena los campos obligatorios (Título y Exposición de motivos).');
      return;
    }
    if (proposalType === 'automatic' && (!variable || !newValue)) {
      Alert.alert('Error', 'Para propuestas automáticas debes indicar la variable y el nuevo valor.');
      return;
    }
    if (proposalType === 'automatic' && variable === 'QUORUM_ASAMBLEA' && parseFloat(newValue) > 100) {
      Alert.alert('Valor Inválido', 'El porcentaje de quórum no puede ser mayor a 100.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Buscar similitudes
      const similares = await gobernanzaApi.buscarSimilares(title);
      if (similares && similares.length > 0) {
        setSimilarProposals(similares);
        setShowSimilarityModal(true);
        setIsSubmitting(false);
        return;
      }
      
      // Si no hay similares, ejecutar creación normal
      await executeCreation();
    } catch (e) {
      Alert.alert('Error', e.message);
      setIsSubmitting(false);
    }
  };

  const executeCreation = async (mergeOptions = {}) => {
    try {
      setIsSubmitting(true);
      const data = {
        title,
        content: description,
        proposal_type: proposalType,
        category: proposalType === 'automatic' ? 'configuracion' : category,
        extra_fields: proposalType === 'automatic' ? { variable, new_value: newValue } : {}
      };
      
      const newProposal = await gobernanzaApi.crearPropuesta(data);
      
      if (mergeOptions.targetId) {
        await gobernanzaApi.solicitarFusion(newProposal.id, mergeOptions.targetId, mergeOptions.asCitation);
      }
      
      Alert.alert(
        'Propuesta Sometida', 
        'Tu propuesta ha sido guardada exitosamente.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={COLORS.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crear Propuesta</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Tipo de Propuesta *</Text>
              <TouchableOpacity 
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setTypeModalVisible(true)}
              >
                <Text style={{ color: COLORS.text, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                  {PROPOSAL_TYPES.find(t => t.id === proposalType)?.label || 'Seleccionar...'}
                </Text>
                <ChevronDown color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, proposalType !== 'standard' && { opacity: 0.5 }]}>Categoría *</Text>
              <TouchableOpacity 
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, proposalType !== 'standard' && { opacity: 0.5 }]}
                onPress={() => proposalType === 'standard' && setCategoryModalVisible(true)}
                disabled={proposalType !== 'standard'}
              >
                <Text style={{ color: COLORS.text, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                  {CATEGORIES.find(c => c.id === category)?.label || 'Seleccionar...'}
                </Text>
                <ChevronDown color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Info color={COLORS.accent} size={16} />
            <Text style={styles.infoText}>
              {PROPOSAL_TYPES.find(t => t.id === proposalType)?.desc}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Título de la Propuesta *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Título de la propuesta..."
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {proposalType === 'automatic' && (
            <View style={styles.automaticFieldsRow}>
              <View style={[styles.flex1, { flex: 1.2 }]}>
                <Text style={styles.inputLabel}>Variable *</Text>
                <TouchableOpacity 
                  style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => setModalVisible(true)}
                  disabled={loadingConfig}
                >
                  {loadingConfig ? <ActivityIndicator size="small" color={COLORS.accent} /> : (
                    <Text style={{ color: variable ? COLORS.text : COLORS.textMuted, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                      {variable ? `${variable} - ${configVariables.find(v => v.key === variable)?.description || 'Sin descripción'}` : "Seleccionar..."}
                    </Text>
                  )}
                  <ChevronDown color={COLORS.textMuted} size={16} />
                </TouchableOpacity>
              </View>
              <View style={{ width: 10 }} />
              <View style={[styles.flex1, { flex: 0.8 }]}>
                <Text style={styles.inputLabel}>Nuevo Valor *</Text>
                {PREDEFINED_VALUES[variable] ? (
                  <TouchableOpacity 
                    style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setValueModalVisible(true)}
                  >
                    <Text style={{ color: newValue ? COLORS.text : COLORS.textMuted, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                      {newValue ? PREDEFINED_VALUES[variable].find(v => v.id === newValue)?.label || newValue : "Seleccionar..."}
                    </Text>
                    <ChevronDown color={COLORS.textMuted} size={16} />
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 3"
                    placeholderTextColor={COLORS.textMuted}
                    value={newValue}
                    onChangeText={setNewValue}
                    keyboardType="numeric"
                  />
                )}
              </View>
            </View>
          )}

          {proposalType === 'automatic' && variable && (
            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 20, marginTop: -10 }}>
              Valor actual del sistema: <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{configVariables.find(v => v.key === variable)?.value}</Text>
            </Text>
          )}

          <Text style={styles.inputLabel}>Exposición de Motivos *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Explica a la asamblea por qué deberían votar a favor de esta propuesta..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleInitialSubmit} disabled={isSubmitting}>
            <Send color={COLORS.background} size={20} />
            <Text style={styles.submitBtnText}>{isSubmitting ? "Procesando..." : "Someter Propuesta"}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals for Type and Category */}
      <Modal visible={typeModalVisible} transparent={true} animationType="slide" onRequestClose={() => setTypeModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTypeModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Propuesta</Text>
            <FlatList
              data={PROPOSAL_TYPES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalOption, proposalType === item.id && styles.modalOptionSelected]}
                  onPress={() => { setProposalType(item.id); setTypeModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, proposalType === item.id && styles.modalOptionTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={categoryModalVisible} transparent={true} animationType="slide" onRequestClose={() => setCategoryModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Categoría</Text>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalOption, category === item.id && styles.modalOptionSelected]}
                  onPress={() => { setCategory(item.id); setCategoryModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, category === item.id && styles.modalOptionTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Selector Modal (Variables) */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar Variable</Text>
            <FlatList
              data={configVariables}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalOption, variable === item.key && styles.modalOptionSelected]}
                  onPress={() => {
                    setVariable(item.key);
                    setModalVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalOptionText, variable === item.key && styles.modalOptionTextSelected]}>
                      {item.key} - {item.description || 'Sin descripción'}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                      Actual: {item.value}
                    </Text>
                  </View>
                  {variable === item.key && <Check color={COLORS.accent} size={18} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Value Selector Modal */}
      <Modal
        visible={valueModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setValueModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setValueModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar Valor</Text>
            <FlatList
              data={PREDEFINED_VALUES[variable] || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalOption, newValue === item.id && styles.modalOptionSelected]}
                  onPress={() => {
                    setNewValue(item.id);
                    setValueModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, newValue === item.id && styles.modalOptionTextSelected]}>
                    {item.label}
                  </Text>
                  {newValue === item.id && <Check color={COLORS.accent} size={18} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Similares Modal */}
      <Modal
        visible={showSimilarityModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <AlertCircle color={COLORS.accent} size={24} />
              <Text style={[styles.modalTitle, { marginBottom: 0, marginLeft: 10 }]}>Propuestas Similares</Text>
            </View>
            <Text style={{ color: COLORS.textMuted, marginBottom: 15 }}>
              Encontramos otras propuestas que podrían tratar de lo mismo. Para no dividir los votos, considera unirte a una existente.
            </Text>
            
            <FlatList
              data={similarProposals}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{item.title}</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 5 }} numberOfLines={2}>{item.content}</Text>
                  
                  <View style={{ flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' }}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: COLORS.accent, flex: 1, marginRight: 5 }]}
                      onPress={() => {
                        setShowSimilarityModal(false);
                        executeCreation({ targetId: item.id, asCitation: false });
                      }}
                    >
                      <Text style={{ color: COLORS.background, fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>Fusionar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: 'transparent', borderColor: COLORS.accent, borderWidth: 1, flex: 1, marginLeft: 5 }]}
                      onPress={() => {
                        setShowSimilarityModal(false);
                        executeCreation({ targetId: item.id, asCitation: true });
                      }}
                    >
                      <Text style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>Solo Citar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
            
            <TouchableOpacity 
              style={{ padding: 15, alignItems: 'center', marginTop: 10 }}
              onPress={() => {
                setShowSimilarityModal(false);
                executeCreation({});
              }}
            >
              <Text style={{ color: COLORS.textMuted, textDecorationLine: 'underline' }}>Ignorar y crear como nueva</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 5,
    marginLeft: -5,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  typeOption: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(245, 166, 35, 0.05)',
  },
  typeText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  typeTextActive: {
    color: COLORS.accent,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 25,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 120,
    paddingTop: 15,
  },
  automaticFieldsRow: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(245, 166, 35, 0.05)',
  },
  modalOptionText: {
    color: COLORS.text,
    fontSize: 15,
  },
  modalOptionTextSelected: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  actionBtn: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  }
});
