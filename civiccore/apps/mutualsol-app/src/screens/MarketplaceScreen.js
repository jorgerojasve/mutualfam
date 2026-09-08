import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Store, Tag } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

const CATEGORIES = ['Todos', 'Alimentos', 'Vestimenta', 'Servicios', 'Electrónica', 'Muebles'];

const MOCK_PRODUCTS = [
  {
    id: '1',
    title: 'Cesta de Verduras Orgánicas',
    category: 'Alimentos',
    price: '15.00',
    acceptsTrade: true,
    seller: 'María (Miembro #102)'
  },
  {
    id: '2',
    title: 'Reparación de Computadoras',
    category: 'Servicios',
    price: '25.00',
    acceptsTrade: false,
    seller: 'Carlos (Miembro #402)'
  },
  {
    id: '3',
    title: 'Camisas de Algodón Artesanales',
    category: 'Vestimenta',
    price: '10.00',
    acceptsTrade: true,
    seller: 'Luisa (Miembro #305)'
  },
  {
    id: '4',
    title: 'Asesoría Contable (1 Hora)',
    category: 'Servicios',
    price: '20.00',
    acceptsTrade: true,
    seller: 'José (Miembro #189)'
  }
];

export default function MarketplaceScreen({ navigation }) {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = MOCK_PRODUCTS.filter(prod => {
    const matchesCategory = activeCategory === 'Todos' || prod.category === activeCategory;
    const matchesSearch = prod.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderProduct = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.imagePlaceholder}>
        <Store color={COLORS.textMuted} size={40} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.seller}>{item.seller}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price} Cr</Text>
          {item.acceptsTrade && (
            <View style={styles.tradeBadge}>
              <Text style={styles.tradeText}>Acepta Trueque</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.buyBtn}>
          <Text style={styles.buyBtnText}>Contactar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mercado Solidario</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search color={COLORS.textMuted} size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar bienes o servicios..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreateOffer')}
      >
        <Plus color={COLORS.background} size={24} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 12,
    fontSize: 16,
  },
  categoriesWrapper: {
    marginBottom: 15,
  },
  categoriesContainer: {
    paddingHorizontal: 15,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 5,
  },
  catBtnActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderColor: COLORS.accent,
  },
  catText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  catTextActive: {
    color: COLORS.accent,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 80,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '48%',
    marginBottom: 15,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    backgroundColor: COLORS.background,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 12,
  },
  categoryBadge: {
    backgroundColor: COLORS.background,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  categoryText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  seller: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  price: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
  tradeBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  tradeText: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: 'bold',
  },
  buyBtn: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyBtnText: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.accent,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  }
});
