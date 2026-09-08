import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, CheckCircle, XCircle, AlertCircle, Share2, Clock, Plus } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useGovernance } from '../hooks/useGovernance';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function GovernanceScreen({ navigation }) {
  const { proposals, loading, error } = useGovernance();

  // Map backend format to UI format
  const mappedProposals = proposals.map(p => ({
    id: p.id.toString(),
    type: 'Resolución / Propuesta',
    applicant: 'Miembro #' + p.proposer_id,
    title: p.title,
    description: p.description,
    quorumNeeded: p.quorum_requirement || 100,
    votes: {
      yes: Math.floor(Math.random() * 50),
      no: Math.floor(Math.random() * 10),
      abstain: 0,
      delegated: 0
    },
    timeLeft: '2 días',
    status: p.status
  }));
  const [localProposals, setLocalProposals] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [userVotes, setUserVotes] = useState({}); // { 'prop-1': 'yes' }
  
  useEffect(() => {
    if (proposals && proposals.length > 0) {
      setLocalProposals(mappedProposals);
    }
  }, [proposals]);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const handleVote = (proposalId, voteType) => {
    if (userVotes[proposalId]) return; // Ya votó

    setLocalProposals(current => 
      current.map(prop => {
        if (prop.id === proposalId) {
          return {
            ...prop,
            votes: {
              ...prop.votes,
              [voteType]: prop.votes[voteType] + 1
            }
          };
        }
        return prop;
      })
    );
    setUserVotes(prev => ({ ...prev, [proposalId]: voteType }));
  };

  const renderProposal = (prop) => {
    const isExpanded = expandedId === prop.id;
    const hasVoted = !!userVotes[prop.id];
    
    const totalVotes = prop.votes.yes + prop.votes.no + prop.votes.abstain + prop.votes.delegated;
    const progress = Math.min((totalVotes / prop.quorumNeeded) * 100, 100);
    const yesPercent = totalVotes > 0 ? (prop.votes.yes / totalVotes) * 100 : 0;

    return (
      <TouchableOpacity 
        key={prop.id} 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={() => toggleExpand(prop.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.propType}>{prop.type}</Text>
          <View style={styles.timeBadge}>
            <Clock color={COLORS.textMuted} size={14} />
            <Text style={styles.timeText}>{prop.timeLeft}</Text>
          </View>
        </View>

        <Text style={styles.propTitle}>{prop.title}</Text>
        <Text style={styles.propApplicant}>Solicitante: {prop.applicant}</Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Quórum: {totalVotes}/{prop.quorumNeeded}</Text>
            <Text style={styles.progressLabel}>A Favor: {yesPercent.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.propDescription}>{prop.description}</Text>
            
            {!hasVoted ? (
              <View style={styles.votingArea}>
                <Text style={styles.votingTitle}>Emite tu Voto (1 Voto = 1 Miembro)</Text>
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
              </View>
            ) : (
              <View style={styles.votedState}>
                <CheckCircle color={COLORS.success} size={24} />
                <Text style={styles.votedText}>Has participado en esta asamblea. ¡Gracias!</Text>
              </View>
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
          La Sociedad Científica opera bajo una gobernanza transparente. Revisa las resoluciones, participa en las elecciones de directiva o delega tu voto a otro investigador de tu departamento si no puedes asistir.
        </Text>

        {loading ? (
          <Text style={{color: COLORS.text, textAlign: 'center', marginTop: 20}}>Cargando resoluciones...</Text>
        ) : error ? (
          <Text style={{color: 'red', textAlign: 'center', marginTop: 20}}>Error: {error}</Text>
        ) : (
          <View style={styles.proposalsContainer}>
            {localProposals.map(renderProposal)}
          </View>
        )}

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
