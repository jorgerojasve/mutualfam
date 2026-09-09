import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, CheckCircle, XCircle, AlertCircle, Share2, Clock, Plus, Play, CheckSquare } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { gobernanzaApi, configApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useIsFocused } from '@react-navigation/native';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function GovernanceScreen({ navigation }) {
  const [proposals, setProposals] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [userVotes, setUserVotes] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [sistemaGobernanza, setSistemaGobernanza] = useState('DOS_FASES');
  const [activeTab, setActiveTab] = useState('debate'); // 'debate' o 'referendos'
  const { user } = useAuthStore();
  
  const isFocused = useIsFocused();

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, config] = await Promise.all([
        gobernanzaApi.listarPropuestas(),
        configApi.getVariables()
      ]);
      setProposals(data);
      const sysGov = config.find(c => c.key === 'SISTEMA_GOBERNANZA');
      if (sysGov) setSistemaGobernanza(sysGov.value);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar las asambleas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const toggleExpand = async (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
    
    // Si expande y no sabemos si ha votado, lo buscamos
    if (expandedId !== id && userVotes[id] === undefined) {
      try {
        const myVote = await gobernanzaApi.miVoto(id);
        if (myVote) {
          setUserVotes(prev => ({ ...prev, [id]: myVote.vote_value }));
        } else {
          setUserVotes(prev => ({ ...prev, [id]: null })); // null significa 'no ha votado'
        }
      } catch (e) {
        console.error("Error al cargar mi voto:", e);
      }
    }
  };

  const handleVote = async (proposalId, voteType) => {
    if (userVotes[proposalId]) return;

    let voteValue = 0.0;
    if (voteType === 'yes') voteValue = 1.0;
    if (voteType === 'no') voteValue = -1.0;
    if (voteType === 'abstain') voteValue = 0.0;

    try {
      await gobernanzaApi.votar(proposalId, voteValue);
      // Optimistic update
      setProposals(current => 
        current.map(prop => {
          if (prop.id === proposalId) {
            return {
              ...prop,
              votes_yes: voteType === 'yes' ? prop.votes_yes + 1 : prop.votes_yes,
              votes_no: voteType === 'no' ? prop.votes_no + 1 : prop.votes_no,
              votes_abstain: voteType === 'abstain' ? prop.votes_abstain + 1 : prop.votes_abstain,
            };
          }
          return prop;
        })
      );
      setUserVotes(prev => ({ ...prev, [proposalId]: voteValue }));
      Alert.alert('Voto Registrado', 'Tu decisión ha sido guardada exitosamente en la asamblea.');
    } catch (e) {
      Alert.alert('Error', e.message);
      if (e.message.includes('already resolved')) {
         setUserVotes(prev => ({ ...prev, [proposalId]: 'already' }));
      }
    }
  };

  const renderProposal = (prop) => {
    const isExpanded = expandedId === prop.id;
    
    const totalVotes = prop.votes_yes + prop.votes_no + prop.votes_abstain + prop.votes_delegated;
    const progress = prop.quorum_needed > 0 ? Math.min((totalVotes / prop.quorum_needed) * 100, 100) : 0;
    const yesPercent = totalVotes > 0 ? (prop.votes_yes / totalVotes) * 100 : 0;
    const isAutomatic = prop.extra_fields?.variable;
    
    // Calcular tiempo restante (mock o real si voting_ends_at existe)
    let timeLeft = "Debate Abierto";
    if (prop.status === 'voting' && prop.voting_ends_at) {
      const ends = new Date(prop.voting_ends_at);
      const now = new Date();
      const diffDays = Math.ceil((ends - now) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) timeLeft = `${diffDays} días`;
      else timeLeft = "Finalizando";
    } else if (prop.status === 'approved') {
      timeLeft = "Aprobada";
    } else if (prop.status === 'rejected') {
      timeLeft = "Rechazada";
    }

    const isAuthor = user?.id === prop.author_id;

    return (
      <TouchableOpacity 
        key={prop.id} 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={() => toggleExpand(prop.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.propType}>{isAutomatic ? "Implementación Automática" : "Acción Humana"}</Text>
          <View style={styles.timeBadge}>
            <Clock color={COLORS.textMuted} size={14} />
            <Text style={styles.timeText}>{timeLeft}</Text>
          </View>
        </View>

        <Text style={styles.propTitle}>{prop.title}</Text>
        <Text style={styles.propApplicant}>Categoría: {prop.category.toUpperCase()}</Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Quórum: {totalVotes}/{prop.quorum_needed}</Text>
            <Text style={styles.progressLabel}>A Favor: {yesPercent.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.propDescription}>{prop.content}</Text>
            {isAutomatic && (
               <View style={{backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: 10, borderRadius: 8, marginBottom: 15}}>
                 <Text style={{color: COLORS.accent, fontWeight: 'bold'}}>Modificará: {prop.extra_fields.variable}</Text>
                 <Text style={{color: COLORS.textMuted}}>Nuevo valor: {prop.extra_fields.new_value}</Text>
               </View>
            )}
            
            {userVotes[prop.id] === null || userVotes[prop.id] === undefined ? (
              <View style={styles.votingArea}>
                {prop.status === 'debate' ? (
                  <>
                    <Text style={styles.votingTitle}>Fase de Ideación</Text>
                    <TouchableOpacity style={[styles.voteBtn, styles.voteYes, { width: '100%' }]} onPress={() => handleVote(prop.id, 'yes')}>
                      <CheckCircle color={COLORS.success} size={20} />
                      <Text style={styles.voteBtnTextYes}>Apoyar Propuesta</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.votingTitle}>Referendo Oficial (1 Voto = 1 Miembro)</Text>
                    <View style={styles.votingButtonsGrid}>
                      <TouchableOpacity style={[styles.voteBtn, styles.voteYes]} onPress={() => handleVote(prop.id, 'yes')}>
                        <CheckCircle color={COLORS.success} size={20} />
                        <Text style={styles.voteBtnTextYes}>A Favor</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={[styles.voteBtn, styles.voteNo]} onPress={() => handleVote(prop.id, 'no')}>
                        <XCircle color={COLORS.accent} size={20} />
                        <Text style={styles.voteBtnTextNo}>En Contra</Text>
                      </TouchableOpacity>
    
                      <TouchableOpacity style={[styles.voteBtn, styles.voteAbstain]} onPress={() => handleVote(prop.id, 'abstain')}>
                        <AlertCircle color={COLORS.textMuted} size={20} />
                        <Text style={styles.voteBtnTextAbstain}>Abstenerse</Text>
                      </TouchableOpacity>
    
                      <TouchableOpacity style={[styles.voteBtn, styles.voteDelegate]} onPress={() => handleVote(prop.id, 'delegated')}>
                        <Share2 color={COLORS.text} size={20} />
                        <Text style={styles.voteBtnTextDelegate}>Delegar</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.votedState}>
                <CheckCircle color={COLORS.success} size={24} />
                <Text style={styles.votedText}>Has apoyado o participado en esta asamblea.</Text>
              </View>
            )}

            {/* Author Actions */}
            {isAuthor && prop.status === 'debate' && (
              <TouchableOpacity 
                style={[styles.voteBtn, { width: '100%', marginTop: 15, borderColor: COLORS.accent }]}
                onPress={async () => {
                  await gobernanzaApi.iniciarReferendo(prop.id);
                  loadData();
                }}
              >
                <Play color={COLORS.accent} size={20} />
                <Text style={[styles.voteBtnTextNo, { marginLeft: 10 }]}>Llamar a Referendo General</Text>
              </TouchableOpacity>
            )}

            {isAuthor && prop.status === 'voting' && sistemaGobernanza === 'UNA_FASE_MANUAL' && (
              <TouchableOpacity 
                style={[styles.voteBtn, { width: '100%', marginTop: 15, borderColor: COLORS.success, backgroundColor: 'rgba(74, 222, 128, 0.1)' }]}
                onPress={async () => {
                  await gobernanzaApi.calcularResultados(prop.id);
                  loadData();
                }}
              >
                <CheckSquare color={COLORS.success} size={20} />
                <Text style={[styles.voteBtnTextYes, { marginLeft: 10 }]}>Finalizar Votación Manualmente</Text>
              </TouchableOpacity>
            )}
            
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Users color={COLORS.accent} size={28} />
          <Text style={styles.headerTitle}>Asamblea Comunitaria</Text>
        </View>

        <Text style={styles.subtitle}>
          MutualSol es una economía verdaderamente democrática. Un miembro representa un voto, independientemente del capital aportado. Revisa las propuestas y ejerce tu decisión soberana o delega tu voto a alguien de confianza.
        </Text>

        {sistemaGobernanza === 'DOS_FASES' && (
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'debate' && styles.activeTab]}
              onPress={() => setActiveTab('debate')}
            >
              <Text style={[styles.tabText, activeTab === 'debate' && styles.activeTabText]}>Foro de Debate</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'referendos' && styles.activeTab]}
              onPress={() => setActiveTab('referendos')}
            >
              <Text style={[styles.tabText, activeTab === 'referendos' && styles.activeTabText]}>Referendos Oficiales</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.proposalsContainer}>
          {loading ? (
             <ActivityIndicator size="large" color={COLORS.accent} style={{marginTop: 50}} />
          ) : proposals.filter(p => 
              sistemaGobernanza === 'DOS_FASES' 
                ? (activeTab === 'debate' ? p.status === 'debate' : p.status !== 'debate')
                : true
            ).length === 0 ? (
             <Text style={{color: COLORS.textMuted, textAlign: 'center', marginTop: 50}}>No hay asambleas activas en esta sección.</Text>
          ) : (
             proposals.filter(p => 
              sistemaGobernanza === 'DOS_FASES' 
                ? (activeTab === 'debate' ? p.status === 'debate' : p.status !== 'debate')
                : true
             ).map(renderProposal)
          )}
        </View>

      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreateProposal')}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 25,
    lineHeight: 20,
  },
  proposalsContainer: {
    gap: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  propType: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 4,
  },
  propTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  propApplicant: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 15,
  },
  progressSection: {
    marginTop: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  expandedContent: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  propDescription: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  votingArea: {
    backgroundColor: COLORS.background,
    padding: 15,
    borderRadius: 12,
  },
  votingTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  votingButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  voteBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  voteYes: {
    borderColor: 'rgba(74, 222, 128, 0.3)',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  voteBtnTextYes: {
    color: COLORS.success,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  voteNo: {
    borderColor: 'rgba(245, 166, 35, 0.3)',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
  },
  voteBtnTextNo: {
    color: COLORS.accent,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  voteAbstain: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  voteBtnTextAbstain: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  voteDelegate: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  voteBtnTextDelegate: {
    color: COLORS.text,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  votedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  votedText: {
    color: COLORS.success,
    fontWeight: 'bold',
    marginLeft: 10,
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
