import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Settings, Users, Info } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

export default function CreateProposalScreen({ navigation }) {
  const [type, setType] = useState('automatic'); // 'automatic' or 'human'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variable, setVariable] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleSubmit = () => {
    if (!title || !description) {
      Alert.alert('Error', 'Por favor llena los campos obligatorios (Título y Exposición de motivos).');
      return;
    }
    if (type === 'automatic' && (!variable || !newValue)) {
      Alert.alert('Error', 'Para propuestas automáticas debes indicar la variable y el nuevo valor.');
      return;
    }

    // Aquí iría la lógica para enviar al backend
    Alert.alert(
      'Propuesta Sometida', 
      'Tu propuesta ha sido enviada a la asamblea exitosamente.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
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
          
          <Text style={styles.sectionTitle}>Tipo de Propuesta</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity 
              style={[styles.typeOption, type === 'automatic' && styles.typeOptionActive]} 
              onPress={() => setType('automatic')}
            >
              <Settings color={type === 'automatic' ? COLORS.accent : COLORS.textMuted} size={24} />
              <Text style={[styles.typeText, type === 'automatic' && styles.typeTextActive]}>
                Implementación{'\n'}Automática
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.typeOption, type === 'human' && styles.typeOptionActive]} 
              onPress={() => setType('human')}
            >
              <Users color={type === 'human' ? COLORS.accent : COLORS.textMuted} size={24} />
              <Text style={[styles.typeText, type === 'human' && styles.typeTextActive]}>
                Acción{'\n'}Humana
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Info color={COLORS.accent} size={16} />
            <Text style={styles.infoText}>
              {type === 'automatic' 
                ? "Estas propuestas modifican parámetros del sistema y se ejecutan solas tras ser aprobadas por la asamblea (Smart Contracts)."
                : "Estas propuestas requieren de intervención humana para ejecutarse, como crear comités, realizar eventos o desarrollar nuevos módulos."}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Título de la Propuesta *</Text>
          <TextInput
            style={styles.input}
            placeholder={type === 'automatic' ? "Ej. Reducción de tasa solidaria" : "Ej. Fiesta de fin de año de la mutual"}
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {type === 'automatic' && (
            <View style={styles.automaticFieldsRow}>
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Variable *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Tasa de Interés"
                  placeholderTextColor={COLORS.textMuted}
                  value={variable}
                  onChangeText={setVariable}
                />
              </View>
              <View style={{ width: 15 }} />
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Nuevo Valor *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 3%"
                  placeholderTextColor={COLORS.textMuted}
                  value={newValue}
                  onChangeText={setNewValue}
                />
              </View>
            </View>
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Send color={COLORS.background} size={20} />
            <Text style={styles.submitBtnText}>Someter a Votación</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
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
  }
});
