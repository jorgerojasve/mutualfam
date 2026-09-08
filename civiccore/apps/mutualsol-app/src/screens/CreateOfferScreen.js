import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Store } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

// Mocks simples para dropdown en MVP
const CATEGORIES = [
  'Alimentos', 'Vestimenta', 'Prendas', 'Bisutería', 
  'Electrónica', 'Muebles', 'Vehículos', 'Inmuebles',
  'Servicios de alimentación', 'Reparación', 'Mantenimiento',
  'Cursos', 'Asesorías'
];

export default function CreateOfferScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [acceptsTrade, setAcceptsTrade] = useState(false);
  const [tradeDetails, setTradeDetails] = useState('');
  // Simulación simple de categoría seleccionada
  const [category, setCategory] = useState(CATEGORIES[0]);

  const handleSubmit = () => {
    if (!title || !price || !description) {
      Alert.alert('Error', 'Por favor llena los campos obligatorios (Título, Precio y Descripción).');
      return;
    }

    Alert.alert(
      'Oferta Publicada', 
      'Tu producto/servicio ya está disponible en el mercado solidario.',
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
          <Text style={styles.headerTitle}>Publicar Oferta</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.imageUploadPlaceholder}>
            <Store color={COLORS.textMuted} size={48} />
            <Text style={styles.uploadText}>Toca para añadir foto</Text>
          </View>

          <Text style={styles.inputLabel}>Título de la Oferta *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Cesta de Verduras Orgánicas"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>Precio (Créditos/USD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 15.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe tu producto o servicio detalladamente..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.switchContainer}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchTitle}>Aceptar Trueque / Intercambio</Text>
              <Text style={styles.switchDesc}>Permite que te ofrezcan bienes o servicios como parte de pago.</Text>
            </View>
            <Switch
              value={acceptsTrade}
              onValueChange={setAcceptsTrade}
              trackColor={{ false: COLORS.border, true: 'rgba(245, 166, 35, 0.5)' }}
              thumbColor={acceptsTrade ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          {acceptsTrade && (
            <View style={styles.fadeContainer}>
              <Text style={styles.inputLabel}>¿Qué aceptas a cambio?</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Acepto servicios de diseño, víveres..."
                placeholderTextColor={COLORS.textMuted}
                value={tradeDetails}
                onChangeText={setTradeDetails}
              />
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Send color={COLORS.background} size={20} />
            <Text style={styles.submitBtnText}>Publicar en el Mercado</Text>
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
  imageUploadPlaceholder: {
    backgroundColor: COLORS.card,
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadText: {
    color: COLORS.textMuted,
    marginTop: 10,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
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
    height: 100,
    paddingTop: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 15,
  },
  switchTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  switchDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  fadeContainer: {
    backgroundColor: 'rgba(245, 166, 35, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
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
