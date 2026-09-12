import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform, ActivityIndicator, Alert, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, CheckCircle, XCircle, AlertCircle, Share2, Clock, Plus, Play, CheckSquare, MessageSquare, Send } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { gobernanzaApi, configApi } from '@civiccore/sdk';
import { useAuthStore } from '@civiccore/sdk';
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
  const [comentariosReferendo, setComentariosReferendo] = useState('false');
  const [puntosHabilitadosReferendo, setPuntosHabilitadosReferendo] = useState('true');
  const [puntosHabilitadosDebate, setPuntosHabilitadosDebate] = useState('false');
  const [maxPuntosPorVoto, setMaxPuntosPorVoto] = useState(5);
  const [activeTab, setActiveTab] = useState('debate'); // 'debate' o 'referendos'
  const { user } = useAuthStore();
  
  // Points state
  const [userPoints, setUserPoints] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState({});
  
  // Comments state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedProposalForComments, setSelectedProposalForComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const isFocused = useIsFocused();

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, config, pointsData] = await Promise.all([
        gobernanzaApi.listarPropuestas(),
        configApi.getVariables(),
        gobernanzaApi.misPuntos().catch(() => null)
      ]);
      setProposals(data);
      if (pointsData) setUserPoints(pointsData);
      
      const sysGov = config.find(c => c.key === 'SISTEMA_GOBERNANZA');
      if (sysGov) setSistemaGobernanza(sysGov.value);
      const comRef = config.find(c => c.key === 'COMENTARIOS_EN_REFERENDO');
      if (comRef) setComentariosReferendo(comRef.value);
      const ptRef = config.find(c => c.key === 'PUNTOS_HABILITADOS_REFERENDO');
      if (ptRef) setPuntosHabilitadosReferendo(ptRef.value);
      const ptDeb = config.find(c => c.key === 'PUNTOS_HABILITADOS_DEBATE');
      if (ptDeb) setPuntosHabilitadosDebate(ptDeb.value);
      const maxPt = config.find(c => c.key === 'MAX_PUNTOS_POR_VOTO');
      if (maxPt) setMaxPuntosPorVoto(parseInt(maxPt.value, 10));
      
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

    const points = selectedPoints[proposalId] || 0;

    try {
      await gobernanzaApi.votar(proposalId, voteValue, points);
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
      if (points > 0 && userPoints) {
          setUserPoints(prev => ({ ...prev, balance: prev.balance - points }));
      }
      Alert.alert('Voto Registrado', 'Tu decisión ha sido guardada exitosamente en la asamblea.');
    } catch (e) {
      Alert.alert('Error', e.message);
      if (e.message.includes('already resolved')) {
         setUserVotes(prev => ({ ...prev, [proposalId]: 'already' }));
      }
    }
  };

  const updateSelectedPoints = (id, delta) => {
      setSelectedPoints(prev => {
          const current = prev[id] || 0;
          const next = current + delta;
          if (next < 0) return prev;
          if (next > maxPuntosPorVoto) return prev;
          if (userPoints && next > userPoints.balance) {
              Alert.alert('Saldo Insuficiente', 'No tienes suficientes Puntos de Voto disponibles.');
              return prev;
          }
          return { ...prev, [id]: next };
      });
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
    const canComment = prop.status === 'debate' || comentariosReferendo === 'true';
    const arePointsEnabled = (prop.status === 'debate' && puntosHabilitadosDebate === 'true') || 
                             (prop.status === 'voting' && puntosHabilitadosReferendo === 'true');
    const pointsUsed = selectedPoints[prop.id] || 0;
    
    // Simplistic Welfare Optimization logic
    const isDirectlyAffected = prop.extra_fields?.affected_cohort === "author_cohort" && isAuthor;

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
                {arePointsEnabled && (
                  <View style={{ marginBottom: 15, padding: 10, backgroundColor: 'rgba(245, 166, 35, 0.05)', borderRadius: 8 }}>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: 'bold', marginBottom: 5 }}>Asignar Puntos de Voto (Opcional)</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 10 }}>Usa tus puntos para darle más peso a tu voto.</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 }}>
                       <TouchableOpacity onPress={() => updateSelectedPoints(prop.id, -1)} style={{ padding: 10, backgroundColor: COLORS.card, borderRadius: 20 }}>
                          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>-</Text>
                       </TouchableOpacity>
                       <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', width: 30, textAlign: 'center' }}>{pointsUsed}</Text>
                       <TouchableOpacity onPress={() => updateSelectedPoints(prop.id, 1)} style={{ padding: 10, backgroundColor: COLORS.card, borderRadius: 20 }}>
                          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>+</Text>
                       </TouchableOpacity>
                    </View>
                    {isDirectlyAffected && (
                        <Text style={{ color: COLORS.success, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                            ¡Eres una parte directamente afectada! Tus votos tendrán x1.5 de impacto.
                        </Text>
                    )}
                  </View>
                )}
                
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
                  try {
                    await gobernanzaApi.iniciarReferendo(prop.id);
                    Alert.alert('Éxito', 'Referendo general iniciado correctamente.');
                    loadData();
                  } catch (error) {
                    Alert.alert('Error', error.message);
                  }
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
                  try {
                    await gobernanzaApi.calcularResultados(prop.id);
                    Alert.alert('Éxito', 'Resultados calculados exitosamente.');
                    loadData();
                  } catch (error) {
                    Alert.alert('Error', error.message);
                  }
                }}
              >
                <CheckSquare color={COLORS.success} size={20} />
                <Text style={[styles.voteBtnTextYes, { marginLeft: 10 }]}>Finalizar Votación Manualmente</Text>
              </TouchableOpacity>
            )}

            {/* Comments Action */}
            {canComment && (
              <TouchableOpacity 
                style={[styles.voteBtn, { width: '100%', marginTop: 15, borderColor: COLORS.textMuted }]}
                onPress={() => openComments(prop)}
              >
                <MessageSquare color={COLORS.textMuted} size={20} />
                <Text style={[styles.voteBtnTextDelegate, { marginLeft: 10 }]}>Ver Foro de Discusión</Text>
              </TouchableOpacity>
            )}
            
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const openComments = async (prop) => {
    setSelectedProposalForComments(prop);
    setShowCommentsModal(true);
    setLoadingComments(true);
    try {
      const data = await gobernanzaApi.listarComentarios(prop.id);
      setComments(data);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar los comentarios');
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const added = await gobernanzaApi.crearComentario(selectedProposalForComments.id, newComment);
      setComments(current => [...current, added]);
      setNewComment('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Users color={COLORS.accent} size={28} />
            <Text style={styles.headerTitle}>Asamblea Comunitaria</Text>
          </View>
          {userPoints && (
            <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: 6, borderRadius: 12}}>
              <Text style={{color: COLORS.accent, fontWeight: 'bold'}}>⭐ {userPoints.balance} pts</Text>
            </View>
          )}
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

      {/* Comments Modal */}
      <Modal visible={showCommentsModal} animationType="slide" transparent={true} onRequestClose={() => setShowCommentsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Foro de Discusión</Text>
              <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                <XCircle color={COLORS.textMuted} size={24} />
              </TouchableOpacity>
            </View>
            
            {loadingComments ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={{marginVertical: 20}} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={<Text style={{color: COLORS.textMuted, textAlign: 'center'}}>No hay comentarios aún. ¡Sé el primero!</Text>}
                renderItem={({ item }) => (
                  <View style={styles.commentCard}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                      <Text style={{color: COLORS.accent, fontWeight: 'bold', fontSize: 12}}>
                        Miembro #{item.author_id}
                      </Text>
                      <Text style={{color: COLORS.textMuted, fontSize: 10}}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={{color: COLORS.text, fontSize: 14}}>{item.content}</Text>
                  </View>
                )}
              />
            )}

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Escribe un comentario..."
                placeholderTextColor={COLORS.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity style={styles.commentSendBtn} onPress={submitComment}>
                <Send color={COLORS.background} size={18} />
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  commentCard: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    backgroundColor: COLORS.card,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentSendBtn: {
    backgroundColor: COLORS.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    marginBottom: 2,
  }
});
