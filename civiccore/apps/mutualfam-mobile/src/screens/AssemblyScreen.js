import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { governanceApi, authApi, loansApi, baseURL } from '../api/client';
import ScreenTitle from '../components/ScreenTitle';
import { OrgContext } from '../context/OrgContext';
import { subscribeRealtime } from '../utils/realtime';
import { getErrorMessage, isNetworkError } from '../utils/errors';
import theme from '../utils/theme';
import { OfflineEmptyState, OfflineNotice } from '../components/OfflineNotice';

export default function AssemblyScreen({ embedded = false }) {
  const { activeOrg, loading: orgLoading, isOffline, setIsOffline, retryConnection } = React.useContext(OrgContext);
  const [currentUser, setCurrentUser] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Visor de Imágenes / Adjuntos del Foro
  const [receiptViewerVisible, setReceiptViewerVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const serverUrl = (baseURL || '').replace('/api/v1', '');

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${serverUrl}${cleanPath}`;
  };

  const openImageViewer = (imgUrl, title = 'Adjunto de la Asamblea', extraInfo = {}) => {
    if (!imgUrl) return;
    const fullUrl = getFullUrl(imgUrl);
    setSelectedReceipt({
      url: fullUrl,
      title: title,
      author: extraInfo.author,
      date: extraInfo.date,
    });
    setImageLoading(true);
    setImageError(false);
    setReceiptViewerVisible(true);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Propuestas y pestañas
  const [activeTab, setActiveTab] = useState('activas'); // 'activas' | 'historial'
  const [propuestas, setPropuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modales
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [proposalDetail, setProposalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modal Proponer Ingreso
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateRelation, setCandidateRelation] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [justificacionIngreso, setJustificacionIngreso] = useState('');
  const [submittingIngreso, setSubmittingIngreso] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  // Modal Proponer Expulsión
  const [showExpulsionModal, setShowExpulsionModal] = useState(false);
  const [expulsables, setExpulsables] = useState([]);
  const [selectedExpulsableId, setSelectedExpulsableId] = useState(null);
  const [motivoExpulsion, setMotivoExpulsion] = useState('');
  const [submittingExpulsion, setSubmittingExpulsion] = useState(false);

  // Formulario Defensa (acusado)
  const [defenseInput, setDefenseInput] = useState('');
  const [submittingDefense, setSubmittingDefense] = useState(false);

  // Foro de debate / comentarios de asamblea
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentStance, setCommentStance] = useState('opinión');
  const [commentAttachment, setCommentAttachment] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const commentInputRef = useRef(null);
  const detailScrollRef = useRef(null);

  // Votación
  const [submittingVote, setSubmittingVote] = useState(false);
  const [closingProposal, setClosingProposal] = useState(false);

  // Cargar usuario actual
  const fetchUser = async () => {
    try {
      const u = await authApi.me();
      setCurrentUser(u);
    } catch (e) {
      console.warn('Error fetching user in AssemblyScreen', e);
    }
  };

  // Cargar propuestas
  const fetchPropuestas = async (isRefresh = false) => {
    if (!activeOrg?.id) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setConnectionError(false);

      const data = await governanceApi.getPropuestas();
      setPropuestas(data);
      if (setIsOffline) setIsOffline(false);
      AsyncStorage.setItem(`cached_asambleas_${activeOrg.id}`, JSON.stringify(data)).catch(() => {});
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
        try {
          const cached = await AsyncStorage.getItem(`cached_asambleas_${activeOrg.id}`);
          if (cached) setPropuestas(JSON.parse(cached));
        } catch (_) {}
      } else {
        console.warn('Error fetching propuestas', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRetryAsambleas = async () => {
    setRetrying(true);
    try {
      await fetchPropuestas();
      if (retryConnection) await retryConnection();
    } finally {
      setRetrying(false);
    }
  };


  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (activeOrg?.id) {
      fetchPropuestas();
    } else if (!orgLoading) {
      setLoading(false);
    }
  }, [activeOrg?.id, orgLoading]);

  useFocusEffect(
    useCallback(() => {
      if (activeOrg?.id) {
        fetchPropuestas();
      }
    }, [activeOrg?.id])
  );

  // Suscripción WebSocket a eventos de gobernanza
  useEffect(() => {
    if (!activeOrg?.id) return;
    const unsubscribe = subscribeRealtime((event) => {
      if (
        event?.type === 'PROPUESTA_CREADA' ||
        event?.type === 'VOTO_EMITIDO' ||
        event?.type === 'DEFENSA_PUBLICADA' ||
        event?.type === 'PROPUESTA_RESUELTA' ||
        event?.type === 'PROPUESTA_COMENTADA'
      ) {
        fetchPropuestas(true);
        if (selectedProposal && event.payload?.proposal_id === selectedProposal.id) {
          openProposalDetail({ id: selectedProposal.id });
        }
      }
    });
    return unsubscribe;
  }, [activeOrg?.id, selectedProposal?.id]);

  // Compartir enlace por WhatsApp / Mensajería
  const handleShareInvite = async (token, name, codeFormatted) => {
    try {
      let inviteUrl = '';
      if (!__DEV__ && process.env.EXPO_PUBLIC_INVITE_URL_BASE) {
        inviteUrl = `${process.env.EXPO_PUBLIC_INVITE_URL_BASE}${token}`;
      } else {
        inviteUrl = Linking.createURL(`join/${token}`);
      }
      const code = codeFormatted || token;
      const targetName = name ? ` ${name}` : '';
      const shareMessage = `¡Hola${targetName}! 👋\n\n¡Has sido aprobado para unirte a nuestra Mutual Familiar en la app MutualFam 🤝!\n\n1️⃣ Abre este enlace e instala la app:\n${inviteUrl}\n\n2️⃣ O ingresa con este código de invitación:\n*${code}*\n\n⏱️ Este código de invitación es válido por 15 días. ¡Bienvenido a la mutual!`;

      await Share.share(
        Platform.OS === 'ios'
          ? { message: shareMessage, url: inviteUrl }
          : { message: shareMessage }
      );
    } catch (e) {
      console.warn('Error sharing invite', e);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copiado', `El código ${code} ha sido copiado al portapapeles.`);
    } catch (e) {
      console.warn('Error copying code', e);
    }
  };

  // Cargar miembros expulsables
  const fetchExpulsables = async () => {
    try {
      const list = await governanceApi.getMiembrosExpulsables();
      setExpulsables(list);
    } catch (e) {
      console.warn('Error fetching expulsables', e);
    }
  };

  // Cargar comentarios del debate
  const fetchComments = async (propId) => {
    try {
      setLoadingComments(true);
      const list = await governanceApi.getComentarios(propId);
      setComments(list);
    } catch (e) {
      console.warn('Error fetching comments', e);
    } finally {
      setLoadingComments(false);
    }
  };

  // Cargar comentarios silenciosamente para polling en tiempo real
  const fetchCommentsSilent = async (propId) => {
    try {
      const list = await governanceApi.getComentarios(propId);
      if (Array.isArray(list)) {
        setComments((prev) => {
          if (
            list.length !== prev.length ||
            list.some((item, idx) => item.id !== prev[idx]?.id || item.content !== prev[idx]?.content)
          ) {
            return list;
          }
          return prev;
        });
      }
    } catch (e) {
      // Silencioso para polling continuo
    }
  };

  // Polling silencioso en tiempo real mientras el detalle de la asamblea esté abierto
  useEffect(() => {
    let interval = null;
    if (showDetailModal && proposalDetail?.id) {
      interval = setInterval(() => {
        fetchCommentsSilent(proposalDetail.id);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDetailModal, proposalDetail?.id]);

  // Responder a un autor específico con mención @
  const handleReplyToAuthor = (authorName) => {
    if (!authorName) return;
    const cleanName = authorName.trim();
    const mention = `@${cleanName} `;
    setReplyingTo(cleanName);
    setCommentText((prev) => {
      if (prev.includes(`@${cleanName}`)) return prev;
      return prev ? `${mention}${prev}` : mention;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
      detailScrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  // Renderizar contenido de comentario destacando menciones @
  const renderCommentContent = (content) => {
    if (!content) return null;
    const authorNames = Array.from(new Set(comments.map((c) => c.author_name).filter(Boolean)));
    const patterns = authorNames
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const patternStr = patterns.length > 0
      ? `(@(?:${patterns.join('|')}|[A-Za-z0-9_]+))`
      : '(@[A-Za-z0-9_]+)';
    const regex = new RegExp(patternStr, 'g');
    const parts = content.split(regex);
    if (!parts || parts.length <= 1) {
      return <Text style={styles.commentContent}>{content}</Text>;
    }
    return (
      <Text style={styles.commentContent}>
        {parts.map((part, idx) => {
          if (part && part.startsWith('@')) {
            return (
              <Text key={idx} style={styles.mentionHighlight}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  // Publicar comentario o intervención en el foro
  const handleSendComment = async () => {
    if (!proposalDetail) return;
    const text = commentText.trim();
    if (!text && !commentAttachment) {
      Alert.alert('Mensaje requerido', 'Por favor escribe tu opinión o adjunta una imagen.');
      return;
    }

    setSubmittingComment(true);
    try {
      let finalAttachmentUrl = null;
      let finalAttachmentType = null;
      if (commentAttachment?.uri) {
        const uploadRes = await loansApi.uploadFile(commentAttachment.uri);
        finalAttachmentUrl = uploadRes.url || uploadRes.file_url;
        finalAttachmentType = commentAttachment.type || 'image';
      }

      await governanceApi.agregarComentario(proposalDetail.id, {
        content: text || 'Imagen adjunta',
        stance: commentStance,
        attachment_url: finalAttachmentUrl,
        attachment_type: finalAttachmentType
      });

      setCommentText('');
      setReplyingTo(null);
      setCommentAttachment(null);
      await fetchComments(proposalDetail.id);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo publicar tu comentario'));
    } finally {
      setSubmittingComment(false);
    }
  };

  // Adjuntar imagen desde la galería (con opción previa de recortar)
  const pickCommentImage = async (crop = false) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Necesitamos acceso a tus fotos para adjuntar imágenes en el foro.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: crop,
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setCommentAttachment({ uri: res.assets[0].uri, type: 'image' });
      }
    } catch (e) {
      console.warn('Error picking image for comment', e);
      Alert.alert('Error', 'No se pudo seleccionar o procesar la imagen de la galería.');
    }
  };

  const handlePickCommentImage = () => {
    Alert.alert(
      'Adjuntar Foto al Foro',
      '¿Deseas recortar la foto antes de adjuntarla?',
      [
        {
          text: '✂️ Recortar foto',
          onPress: () => pickCommentImage(true),
        },
        {
          text: '🖼️ Foto completa (sin recortar)',
          onPress: () => pickCommentImage(false),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  // Abrir modal de detalle
  const openProposalDetail = async (proposal) => {
    setSelectedProposal(proposal);
    setShowDetailModal(true);
    setLoadingDetail(true);
    setCommentText('');
    setReplyingTo(null);
    setCommentAttachment(null);
    try {
      const [full, commentList] = await Promise.all([
        governanceApi.getPropuesta(proposal.id),
        governanceApi.getComentarios(proposal.id).catch(() => [])
      ]);
      setProposalDetail(full);
      setDefenseInput(full.defense_text || '');
      setComments(commentList);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo cargar el detalle de la propuesta'));
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Proponer Ingreso
  const handleProponerIngreso = async () => {
    if (!candidateName.trim()) {
      Alert.alert('Atención', 'Ingresa el nombre completo del familiar o candidato.');
      return;
    }
    if (!justificacionIngreso.trim()) {
      Alert.alert('Atención', 'Ingresa una justificación para la propuesta de ingreso.');
      return;
    }

    setSubmittingIngreso(true);
    try {
      const res = await governanceApi.proponerIngreso({
        candidate_name: candidateName.trim(),
        candidate_relation: candidateRelation.trim() || undefined,
        candidate_phone: candidatePhone.trim() || undefined,
        justificacion: justificacionIngreso.trim()
      });

      setCreatedInvite({
        invite_token: res.invite_token,
        invite_code_formatted: res.invite_code_formatted || res.invite_token,
        candidate_name: candidateName.trim(),
        expires_at: res.invite_expires_at,
        status: res.status
      });

      fetchPropuestas(true);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo proponer el ingreso'));
    } finally {
      setSubmittingIngreso(false);
    }
  };

  // Proponer Expulsión
  const handleProponerExpulsion = async () => {
    if (!selectedExpulsableId) {
      Alert.alert('Atención', 'Selecciona a un miembro de la lista.');
      return;
    }
    if (!motivoExpulsion.trim()) {
      Alert.alert('Atención', 'Ingresa el motivo detallado de la expulsión.');
      return;
    }

    const debateDias = theme.isQA ? '1 día' : '10 días';
    Alert.alert(
      'Confirmar Propuesta de Expulsión',
      `¿Estás seguro de que deseas someter a votación la expulsión de este miembro? Se abrirá un período de ${debateDias} de debate y defensa obligatoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Proponer',
          style: 'destructive',
          onPress: async () => {
            setSubmittingExpulsion(true);
            try {
              await governanceApi.proponerExpulsion({
                target_user_id: selectedExpulsableId,
                motivo: motivoExpulsion.trim()
              });
              Alert.alert('Propuesta Registrada', 'Se ha iniciado el proceso de expulsión con fase de debate.');
              setShowExpulsionModal(false);
              setSelectedExpulsableId(null);
              setMotivoExpulsion('');
              fetchPropuestas(true);
            } catch (e) {
              Alert.alert('Error', getErrorMessage(e, 'No se pudo proponer la expulsión'));
            } finally {
              setSubmittingExpulsion(false);
            }
          }
        }
      ]
    );
  };

  // Emitir Voto
  const handleVotar = async (voto) => {
    if (!proposalDetail) return;

    let confirmMsg = `¿Deseas registrar tu voto como "${voto.toUpperCase()}"?`;
    if (voto === 'no' && proposalDetail.proposal_type === 'member_admission') {
      confirmMsg = '⚠️ ATENCIÓN: Un voto en contra (NO) en una propuesta de ingreso activará el VETO nominativo del grupo y rechazará la admisión. ¿Confirmas tu voto?';
    }

    Alert.alert('Confirmar Voto', confirmMsg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setSubmittingVote(true);
          try {
            await governanceApi.votar(proposalDetail.id, voto);
            Alert.alert('¡Voto Registrado!', `Has votado: ${voto.toUpperCase()}`);
            openProposalDetail({ id: proposalDetail.id });
            fetchPropuestas(true);
          } catch (e) {
            Alert.alert('Error al Votar', getErrorMessage(e, 'No se pudo registrar el voto'));
          } finally {
            setSubmittingVote(false);
          }
        }
      }
    ]);
  };

  // Publicar / Actualizar Defensa
  const handlePublicarDefensa = async () => {
    if (!proposalDetail || !defenseInput.trim()) {
      Alert.alert('Atención', 'Ingresa el texto de tu defensa.');
      return;
    }

    setSubmittingDefense(true);
    try {
      await governanceApi.publicarDefensa(proposalDetail.id, defenseInput.trim());
      Alert.alert('Defensa Publicada', 'Tu defensa ha sido registrada y está visible para todos los miembros.');
      openProposalDetail({ id: proposalDetail.id });
      fetchPropuestas(true);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo registrar la defensa'));
    } finally {
      setSubmittingDefense(false);
    }
  };

  // Cerrar y Computar Resultado
  const handleCerrarPropuesta = async () => {
    if (!proposalDetail) return;
    Alert.alert(
      'Cerrar Propuesta',
      '¿Deseas cerrar la propuesta y calcular el resultado oficial ahora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar y Computar',
          onPress: async () => {
            setClosingProposal(true);
            try {
              const res = await governanceApi.cerrarPropuesta(proposalDetail.id);
              Alert.alert(
                res.status === 'approved' ? '🎉 Propuesta Aprobada' : '🚫 Propuesta Rechazada',
                res.status === 'approved'
                  ? 'La propuesta ha sido aprobada exitosamente.'
                  : (res.veto_activated ? `Rechazada por veto nominativo.` : 'La propuesta no alcanzó los votos requeridos.')
              );
              openProposalDetail({ id: proposalDetail.id });
              fetchPropuestas(true);
            } catch (e) {
              Alert.alert('Error al Cerrar', getErrorMessage(e, 'No se pudo cerrar la propuesta'));
            } finally {
              setClosingProposal(false);
            }
          }
        }
      ]
    );
  };

  // Filtrado de propuestas
  const propuestasFiltradas = propuestas.filter((p) => {
    const isActiva = p.status === 'debate' || p.status === 'voting';
    return activeTab === 'activas' ? isActiva : !isActiva;
  });

  const countActivas = propuestas.filter((p) => p.status === 'debate' || p.status === 'voting').length;
  const countHistorial = propuestas.filter((p) => p.status !== 'debate' && p.status !== 'voting').length;

  // Render de tarjeta de propuesta
  const renderProposalCard = ({ item }) => {
    const isAdmission = item.proposal_type === 'member_admission';
    const isDebate = item.status === 'debate';
    const isVoting = item.status === 'voting';
    const isApproved = item.status === 'approved';
    const isRejected = item.status === 'rejected';

    let statusColor = '#f59e0b';
    let statusLabel = '⏳ Debate';
    if (isVoting) {
      statusColor = '#3b82f6';
      statusLabel = '🗳️ Votación';
    } else if (isApproved) {
      statusColor = '#10b981';
      statusLabel = '✅ Aprobada';
    } else if (isRejected) {
      statusColor = '#ef4444';
      statusLabel = item.veto_activated ? '🚫 Vetada' : '❌ Rechazada';
    }

    const totalVotos = (item.votes_yes || 0) + (item.votes_no || 0) + (item.votes_abstain || 0);

    return (
      <TouchableOpacity
        style={styles.proposalCard}
        activeOpacity={0.85}
        onPress={() => openProposalDetail(item)}
      >
        <View style={styles.cardHeaderRow}>
          <View style={[styles.typeBadge, { backgroundColor: isAdmission ? '#0369a1' : '#be123c' }]}>
            <Text style={styles.typeBadgeText}>
              {isAdmission ? '📥 Admisión de Miembro' : '⚠️ Expulsión de Miembro'}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            👤 Propuesto por: <Text style={styles.metaHighlight}>{item.author_name}</Text>
          </Text>
          {item.time_remaining_seconds > 0 && (
            <Text style={styles.timerText}>
              ⏱️ {Math.ceil(item.time_remaining_seconds / 86400)}d restantes
            </Text>
          )}
        </View>

        {/* Datos y Enlace de Invitación para Admisión de Miembro */}
        {isAdmission && (
          <View style={styles.admissionSnippetContainer}>
            {item.candidate_relation ? (
              <Text style={styles.admissionRelationText}>
                🤝 Parentesco: <Text style={{ color: '#f8fafc', fontWeight: '600' }}>{item.candidate_relation}</Text>
              </Text>
            ) : null}
            {item.status === 'approved' && item.invite_token && (
              <View style={styles.inviteSnippetRow}>
                <View style={styles.inviteSnippetCodePill}>
                  <Text style={styles.inviteSnippetCodeText}>
                    🔑 {item.invite_code_formatted || item.invite_token}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.shareSnippetBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleShareInvite(
                      item.invite_token,
                      item.candidate_name,
                      item.invite_code_formatted
                    );
                  }}
                >
                  <Text style={styles.shareSnippetBtnText}>💬 Compartir</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.redeemed_by_name ? (
              <Text style={styles.redeemedText}>
                👤 Cuenta vinculada: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{item.redeemed_by_name}</Text>
              </Text>
            ) : item.status === 'approved' && item.invite_token ? (
              <Text style={styles.pendingClaimText}>
                ⏳ Invitación de 15 días aprobada y lista para canje
              </Text>
            ) : (isDebate || isVoting) ? (
              <Text style={styles.pendingAssemblyText}>
                ⚖️ En proceso de asamblea (El enlace se generará una vez aprobado)
              </Text>
            ) : null}
          </View>
        )}

        {/* Resumen de Votos (solo visible a partir de la fase de votación) */}
        {!isDebate ? (
          <View style={styles.voteSummaryContainer}>
            <View style={styles.voteCounter}>
              <Text style={styles.voteCounterText}>
                👍 <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{item.votes_yes || 0}</Text> SÍ
              </Text>
              <Text style={styles.voteCounterText}>
                👎 <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.votes_no || 0}</Text> NO
              </Text>
              <Text style={styles.voteCounterText}>
                ⬜ <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>{item.votes_abstain || 0}</Text> Abst.
              </Text>
            </View>

            {item.my_vote && (
              <View style={styles.myVoteBadge}>
                <Text style={styles.myVoteText}>
                  Tu voto: <Text style={{ fontWeight: 'bold', color: item.my_vote === 'si' ? '#10b981' : item.my_vote === 'no' ? '#ef4444' : '#94a3b8' }}>{item.my_vote.toUpperCase()}</Text>
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.voteSummaryContainer}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
              💬 En debate • Votación aún no iniciada
            </Text>
          </View>
        )}

        {/* Banner de veto si aplica */}
        {item.veto_activated && item.vetantes_names?.length > 0 && (
          <View style={styles.vetoBanner}>
            <Text style={styles.vetoBannerText}>
              🚫 Vetada nominativamente por: {item.vetantes_names.join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailText}>
            {isVoting ? '🗳️ Ver y Votar →' : 'Ver Detalle de Asamblea →'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!activeOrg?.id) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          Selecciona una mutual en la barra superior para acceder a la Asamblea.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, embedded && { paddingHorizontal: 0, backgroundColor: 'transparent' }]}>
      {!embedded && <ScreenTitle title="🏛️ Asamblea Familiar" />}

      {/* Botones de acción principales */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.proposeAdmissionButton}
          onPress={() => {
            setCreatedInvite(null);
            setShowIngresoModal(true);
          }}
        >
          <Text style={styles.buttonIcon}>📥</Text>
          <Text style={styles.admissionButtonText}>Proponer Ingreso</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.proposeExpulsionButton}
          onPress={() => {
            fetchExpulsables();
            setShowExpulsionModal(true);
          }}
        >
          <Text style={styles.buttonIcon}>⚠️</Text>
          <Text style={styles.expulsionButtonText}>Proponer Expulsión</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Activas vs Historial */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'activas' && styles.tabButtonActive]}
          onPress={() => setActiveTab('activas')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'activas' && styles.tabButtonTextActive]}>
            {(isOffline || connectionError) && countActivas === 0 ? 'Activas (Sin conexión)' : `Activas (${countActivas})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'historial' && styles.tabButtonActive]}
          onPress={() => setActiveTab('historial')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'historial' && styles.tabButtonTextActive]}>
            {(isOffline || connectionError) && countHistorial === 0 ? 'Historial (Sin conexión)' : `Historial (${countHistorial})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Aviso Offline */}
      {(isOffline || connectionError) && propuestasFiltradas.length > 0 ? (
        <OfflineNotice
          message="Sin conexión de red · Mostrando asambleas guardadas"
          onRetry={handleRetryAsambleas}
          loading={retrying}
        />
      ) : null}

      {/* Lista de propuestas */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent || '#10b981'} />
        </View>
      ) : (
        <FlatList
          data={propuestasFiltradas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProposalCard}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPropuestas(true)}
              tintColor={theme.accent || '#10b981'}
            />
          }
          ListEmptyComponent={
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar las propuestas de asamblea. Tus datos están seguros y no se han eliminado. Por favor, intenta de nuevo cuando tengas conexión."
                onRetry={handleRetryAsambleas}
                loading={retrying}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🏛️</Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'activas' ? 'No hay propuestas en debate o votación' : 'No hay propuestas en el historial'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {activeTab === 'activas'
                    ? 'Cualquier miembro activo puede proponer nuevos ingresos o temas a la asamblea.'
                    : 'Las decisiones aprobadas o rechazadas aparecerán aquí.'}
                </Text>
              </View>
            )
          }
        />
      )}

      {/* ======================================================== */}
      {/* MODAL DETALLE Y VOTACIÓN                                 */}
      {/* ======================================================== */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            {loadingDetail || !proposalDetail ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 12 }}>Cargando detalle de asamblea...</Text>
              </View>
            ) : (
              <ScrollView
                ref={detailScrollRef}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
              >
                {/* Header Modal */}
                <View style={styles.modalHeaderRow}>
                  <View style={[styles.typeBadge, { backgroundColor: proposalDetail.proposal_type === 'member_admission' ? '#0369a1' : '#be123c' }]}>
                    <Text style={styles.typeBadgeText}>
                      {proposalDetail.proposal_type === 'member_admission' ? '📥 Ingreso' : '⚠️ Expulsión'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setShowDetailModal(false);
                    setReplyingTo(null);
                  }}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalTitle}>{proposalDetail.title}</Text>

                {/* Fase y tiempo */}
                <View style={styles.phaseAlert}>
                  <Text style={styles.phaseAlertTitle}>{proposalDetail.phase_label}</Text>
                  {proposalDetail.time_remaining_seconds > 0 && (
                    <Text style={styles.phaseAlertSub}>
                      Tiempo restante: {Math.ceil(proposalDetail.time_remaining_seconds / 86400)} días
                    </Text>
                  )}
                </View>

                {/* Info Justificación / Motivo */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeader}>Motivo / Justificación:</Text>
                  <Text style={styles.sectionBody}>{proposalDetail.content}</Text>
                  {proposalDetail.candidate_relation ? (
                    <Text style={styles.proposerNote}>🤝 Parentesco / Vínculo: {proposalDetail.candidate_relation}</Text>
                  ) : null}
                  <Text style={styles.proposerNote}>👤 Propuesto por: {proposalDetail.author_name}</Text>
                </View>

                {/* Enlace de Invitación Oficial (Admisión) */}
                {proposalDetail.proposal_type === 'member_admission' && (
                  proposalDetail.status === 'approved' && proposalDetail.invite_token ? (
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeader}>Enlace de Invitación Oficial:</Text>
                      <View style={styles.detailInviteBox}>
                        <Text style={styles.detailInviteCode}>
                          {proposalDetail.invite_code_formatted || proposalDetail.invite_token}
                        </Text>
                        <Text style={styles.detailInviteSub}>
                          {proposalDetail.redeemed_by_name
                            ? `✅ Canjeado por ${proposalDetail.redeemed_by_name}`
                            : '⏳ Invitación aprobada de 15 días. Lista para compartir con el familiar.'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <TouchableOpacity
                            style={[styles.primaryButton, { flex: 1, backgroundColor: '#16a34a', marginVertical: 0 }]}
                            onPress={() =>
                              handleShareInvite(
                                proposalDetail.invite_token,
                                proposalDetail.candidate_name,
                                proposalDetail.invite_code_formatted
                              )
                            }
                          >
                            <Text style={styles.primaryButtonText}>💬 WhatsApp</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.secondaryButton, { flex: 1, marginVertical: 0 }]}
                            onPress={() => handleCopyCode(proposalDetail.invite_code_formatted || proposalDetail.invite_token)}
                          >
                            <Text style={styles.secondaryButtonText}>📋 Copiar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (proposalDetail.status === 'debate' || proposalDetail.status === 'voting') ? (
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeader}>Estado de la Invitación:</Text>
                      <View style={styles.infoBanner}>
                        <Text style={styles.infoBannerText}>
                          ⚖️ La propuesta se encuentra en período de {proposalDetail.status === 'debate' ? 'debate' : 'votación'}. El enlace y código de invitación se generarán automáticamente en cuanto la asamblea apruebe el ingreso.
                        </Text>
                      </View>
                    </View>
                  ) : null
                )}

                {/* Sección de Defensa (Expulsión) */}
                {proposalDetail.proposal_type === 'expulsion' && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionHeader}>Defensa del Miembro Acusado:</Text>
                    {proposalDetail.defense_text ? (
                      <View style={styles.defenseQuoteBox}>
                        <Text style={styles.defenseQuoteText}>"{proposalDetail.defense_text}"</Text>
                      </View>
                    ) : (
                      <Text style={styles.noDefenseText}>
                        El miembro aún no ha publicado su texto de defensa.
                      </Text>
                    )}

                    {/* Formulario de defensa si el usuario actual es el acusado */}
                    {currentUser?.id === proposalDetail.target_member_id && proposalDetail.status === 'debate' && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.inputLabel}>Tu texto de defensa:</Text>
                        <TextInput
                          style={styles.textArea}
                          placeholder="Escribe tus argumentos o explicaciones para la asamblea..."
                          placeholderTextColor="#64748b"
                          multiline
                          numberOfLines={4}
                          value={defenseInput}
                          onChangeText={setDefenseInput}
                        />
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={handlePublicarDefensa}
                          disabled={submittingDefense}
                        >
                          {submittingDefense ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryButtonText}>
                              {proposalDetail.defense_text ? 'Actualizar Mi Defensa' : 'Publicar Mi Defensa'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Conteo de Votos y Resultados (Solo visible una vez iniciado el período de votación) */}
                {proposalDetail.status !== 'debate' && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionHeader}>Estado de Votación</Text>
                    <View style={styles.voteStatsGrid}>
                      <View style={[styles.voteStatBox, { borderColor: '#10b981' }]}>
                        <Text style={[styles.voteStatVal, { color: '#10b981' }]}>{proposalDetail.votes_yes || 0}</Text>
                        <Text style={styles.voteStatLbl}>A FAVOR (SÍ)</Text>
                      </View>
                      <View style={[styles.voteStatBox, { borderColor: '#ef4444' }]}>
                        <Text style={[styles.voteStatVal, { color: '#ef4444' }]}>{proposalDetail.votes_no || 0}</Text>
                        <Text style={styles.voteStatLbl}>EN CONTRA (NO)</Text>
                      </View>
                      <View style={[styles.voteStatBox, { borderColor: '#94a3b8' }]}>
                        <Text style={[styles.voteStatVal, { color: '#94a3b8' }]}>{proposalDetail.votes_abstain || 0}</Text>
                        <Text style={styles.voteStatLbl}>ABSTENCIÓN</Text>
                      </View>
                    </View>

                    {proposalDetail.proposal_type === 'member_admission' && (
                      <Text style={styles.ruleNote}>
                        * Regla de Admisión: Requiere ≥75% de aprobación y cero votos NO (Consenso con Veto).
                      </Text>
                    )}
                    {proposalDetail.proposal_type === 'expulsion' && (
                      <Text style={styles.ruleNote}>
                        * Regla de Expulsión: Requiere supermayoría de 75% de los votos emitidos.
                      </Text>
                    )}
                  </View>
                )}

                {/* Botones de Voto si está en fase de votación */}
                {proposalDetail.status === 'voting' && (
                  <View style={styles.votingActionContainer}>
                    <Text style={styles.votingHeader}>Emite tu voto (nominativo):</Text>
                    <View style={styles.voteButtonsRow}>
                      <TouchableOpacity
                        style={[styles.voteBtn, styles.voteBtnSi, proposalDetail.my_vote === 'si' && styles.voteBtnSelected]}
                        onPress={() => handleVotar('si')}
                        disabled={submittingVote}
                      >
                        <Text style={styles.voteBtnText}>👍 SÍ</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voteBtn, styles.voteBtnNo, proposalDetail.my_vote === 'no' && styles.voteBtnSelected]}
                        onPress={() => handleVotar('no')}
                        disabled={submittingVote}
                      >
                        <Text style={styles.voteBtnText}>
                          👎 NO {proposalDetail.proposal_type === 'member_admission' ? '(Veto)' : ''}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voteBtn, styles.voteBtnAbstain, proposalDetail.my_vote === 'abstencion' && styles.voteBtnSelected]}
                        onPress={() => handleVotar('abstencion')}
                        disabled={submittingVote}
                      >
                        <Text style={styles.voteBtnText}>⬜ Abstención</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* FORO DE DEBATE Y DELIBERACIÓN */}
                <View style={styles.sectionCard}>
                  <View style={styles.forumHeaderRow}>
                    <Text style={styles.sectionHeader}>💬 Foro de Debate ({comments.length})</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {loadingComments ? (
                        <ActivityIndicator size="small" color="#38bdf8" />
                      ) : (
                        <TouchableOpacity
                          onPress={() => fetchComments(proposalDetail.id)}
                          style={styles.refreshForumBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.refreshForumBtnText}>🔄 Actualizar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {proposalDetail.status === 'debate' && (
                    <View style={styles.debateNoticeBox}>
                      <Text style={styles.debateNoticeTitle}>💬 Período de Deliberación Activo</Text>
                      <Text style={styles.debateNoticeSub}>
                        Expresa tus argumentos, dudas o preguntas antes de la votación formal.
                      </Text>
                    </View>
                  )}

                  {comments.length === 0 ? (
                    <View style={styles.emptyCommentsBox}>
                      <Text style={styles.emptyCommentsText}>
                        Aún no hay comentarios en este debate. ¡Sé el primero en compartir tu opinión con la familia!
                      </Text>
                    </View>
                  ) : (
                    comments.map((c) => {
                      let stanceColor = '#38bdf8';
                      let stanceBg = '#075985';
                      let stanceText = '💬 Opinión';
                      if (c.stance === 'favor') {
                        stanceColor = '#34d399';
                        stanceBg = '#065f46';
                        stanceText = '👍 A favor';
                      } else if (c.stance === 'contra') {
                        stanceColor = '#f87171';
                        stanceBg = '#881337';
                        stanceText = '👎 En contra';
                      } else if (c.stance === 'duda') {
                        stanceColor = '#facc15';
                        stanceBg = '#854d0e';
                        stanceText = '🤔 Con dudas';
                      }

                      return (
                        <View key={c.id} style={[styles.commentCard, c.is_mine && styles.myCommentCard]}>
                          <View style={styles.commentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 4 }}>
                              <Text style={styles.commentAuthor}>👤 {c.author_name}</Text>
                              {c.is_mine && <Text style={styles.myCommentBadge}> (Tú)</Text>}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={styles.replyCommentBtn}
                                onPress={() => handleReplyToAuthor(c.author_name)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.replyCommentBtnText}>@ Responder</Text>
                              </TouchableOpacity>
                              {c.stance ? (
                                <View style={[styles.stanceBadge, { backgroundColor: stanceBg }]}>
                                  <Text style={[styles.stanceBadgeText, { color: stanceColor }]}>{stanceText}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          {renderCommentContent(c.content)}
                          {c.attachment_url && c.attachment_type === 'image' && (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => openImageViewer(
                                c.attachment_url,
                                `Adjunto - ${c.author_name}`,
                                { author: c.author_name, date: c.created_at }
                              )}
                              style={styles.commentImageTouchable}
                            >
                              <Image
                                source={{ uri: getFullUrl(c.attachment_url) }}
                                style={styles.commentImageAttachment}
                                resizeMode="cover"
                              />
                              <View style={styles.imageTapHint}>
                                <Text style={styles.imageTapHintText}>🔍 Toca para ampliar imagen</Text>
                              </View>
                            </TouchableOpacity>
                          )}
                          <Text style={styles.commentDate}>
                            {c.created_at ? new Date(c.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </Text>
                        </View>
                      );
                    })
                  )}

                  {/* Formulario para publicar en el foro */}
                  {(proposalDetail.status === 'debate' || proposalDetail.status === 'voting') && (
                    <View style={styles.addCommentBox}>
                      <Text style={styles.addCommentLabel}>Tu postura o intervención:</Text>
                      <View style={styles.stancePillsRow}>
                        {[
                          { key: 'favor', label: '👍 A favor' },
                          { key: 'contra', label: '👎 En contra' },
                          { key: 'duda', label: '🤔 Con dudas' },
                          { key: 'opinión', label: '💬 Opinión' },
                        ].map((s) => (
                          <TouchableOpacity
                            key={s.key}
                            style={[
                              styles.stancePill,
                              commentStance === s.key && styles.stancePillSelected
                            ]}
                            onPress={() => setCommentStance(s.key)}
                          >
                            <Text
                              style={[
                                styles.stancePillText,
                                commentStance === s.key && styles.stancePillTextSelected
                              ]}
                            >
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {replyingTo && (
                        <View style={styles.replyingBanner}>
                          <Text style={styles.replyingText}>
                            ↩️ Respondiendo a <Text style={styles.replyingAuthor}>@{replyingTo}</Text>
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setReplyingTo(null);
                              setCommentText((prev) => prev.replace(`@${replyingTo} `, '').replace(`@${replyingTo}`, ''));
                            }}
                            style={styles.cancelReplyBtn}
                          >
                            <Text style={styles.cancelReplyText}>✕ Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <TextInput
                        ref={commentInputRef}
                        style={styles.commentTextInput}
                        placeholder={replyingTo ? `Responde a @${replyingTo}...` : "Escribe tu argumento o pregunta para la asamblea..."}
                        placeholderTextColor="#64748b"
                        multiline
                        value={commentText}
                        onChangeText={(txt) => {
                          setCommentText(txt);
                          if (replyingTo && !txt.includes(`@${replyingTo}`)) {
                            setReplyingTo(null);
                          }
                        }}
                      />

                      {commentAttachment && (
                        <View style={styles.attachmentPreviewRow}>
                          <Image source={{ uri: commentAttachment.uri }} style={styles.attachmentThumb} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.attachmentLabel}>Foto lista para el foro</Text>
                            <TouchableOpacity onPress={handlePickCommentImage} style={{ marginTop: 2 }}>
                              <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '600' }}>✏️ Cambiar / Recortar otra</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity onPress={() => setCommentAttachment(null)}>
                            <Text style={styles.removeAttachmentText}>✕ Quitar</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={styles.commentActionsRow}>
                        <TouchableOpacity
                          style={styles.attachButton}
                          onPress={handlePickCommentImage}
                        >
                          <Text style={styles.attachButtonText}>📷 Adjuntar Foto</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.sendCommentButton, (!commentText.trim() && !commentAttachment) && styles.sendCommentButtonDisabled]}
                          onPress={handleSendComment}
                          disabled={submittingComment || (!commentText.trim() && !commentAttachment)}
                        >
                          {submittingComment ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.sendCommentButtonText}>Publicar en Foro</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Desglose Nominativo de Votos */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeader}>Registro de Votantes (Nominativo)</Text>
                  {!proposalDetail.votes_list || proposalDetail.votes_list.length === 0 ? (
                    <Text style={styles.emptyVotersText}>Aún no se han emitido votos en esta asamblea.</Text>
                  ) : (
                    proposalDetail.votes_list.map((v, idx) => (
                      <View key={idx} style={styles.voterRow}>
                        <Text style={styles.voterName}>👤 {v.voter_name}</Text>
                        <View style={[styles.voterPill, { backgroundColor: v.choice === 'si' ? '#065f46' : v.choice === 'no' ? '#881337' : '#334155' }]}>
                          <Text style={styles.voterPillText}>{v.choice.toUpperCase()}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Botón de Cierre Manual / Computar */}
                {(proposalDetail.status === 'voting' || proposalDetail.status === 'debate') && (
                  <TouchableOpacity
                    style={styles.closeProposalButton}
                    onPress={handleCerrarPropuesta}
                    disabled={closingProposal}
                  >
                    {closingProposal ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.closeProposalButtonText}>
                        Computar Resultados y Cerrar Propuesta
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Volver a la Lista</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL PROPONER INGRESO                                   */}
      {/* ======================================================== */}
      <Modal visible={showIngresoModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            {createdInvite ? (
              <View style={styles.successModalContainer}>
                {createdInvite.status === 'approved' ? (
                  <>
                    <View style={styles.successBadgeCircle}>
                      <Text style={{ fontSize: 34 }}>🎉</Text>
                    </View>
                    <Text style={styles.successModalTitle}>¡Ingreso Aprobado Inmediatamente!</Text>
                    <Text style={styles.successModalSubtext}>
                      Al ser el único miembro activo de la mutual, el ingreso de{' '}
                      <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>{createdInvite.candidate_name}</Text>{' '}
                      no requiere votación en asamblea. Ya puedes compartir la invitación.
                    </Text>

                    <View style={styles.inviteShareBox}>
                      <Text style={styles.inviteShareBoxLabel}>CÓDIGO DE INVITACIÓN OFICIAL (15 DÍAS)</Text>
                      <Text style={styles.inviteShareBoxCode}>{createdInvite.invite_code_formatted}</Text>
                      <View style={styles.inviteBadgeRow}>
                        <Text style={styles.inviteValidityBadge}>⏱️ Válido por 15 días</Text>
                        <Text style={styles.inviteGovBadge}>✅ Aprobado</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.whatsappShareButton}
                      onPress={() =>
                        handleShareInvite(
                          createdInvite.invite_token,
                          createdInvite.candidate_name,
                          createdInvite.invite_code_formatted
                        )
                      }
                    >
                      <Text style={styles.whatsappShareButtonText}>💬 Enviar por WhatsApp / Mensajería</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.copyCodeButton}
                      onPress={() => handleCopyCode(createdInvite.invite_code_formatted || createdInvite.invite_token)}
                    >
                      <Text style={styles.copyCodeButtonText}>📋 Copiar Código</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={[styles.successBadgeCircle, { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}>
                      <Text style={{ fontSize: 34 }}>💬</Text>
                    </View>
                    <Text style={styles.successModalTitle}>¡Propuesta en Período de Debate!</Text>
                    <Text style={styles.successModalSubtext}>
                      Se ha iniciado el período de {theme.isQA ? '1 día' : '4 días'} de debate en la asamblea familiar para{' '}
                      <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>{createdInvite.candidate_name}</Text>.
                    </Text>

                    <View style={styles.pendingAssemblyBoxModal}>
                      <Text style={styles.pendingAssemblyBoxTitle}>⚖️ Sujeto a Votación de la Asamblea</Text>
                      <Text style={styles.pendingAssemblyBoxText}>
                        El enlace y código de invitación se generarán automáticamente en cuanto la asamblea apruebe el ingreso. Los miembros ya pueden deliberar en el foro de debate.
                      </Text>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={styles.finishButton}
                  onPress={() => {
                    setShowIngresoModal(false);
                    setCreatedInvite(null);
                    setCandidateName('');
                    setCandidateRelation('');
                    setCandidatePhone('');
                    setJustificacionIngreso('');
                  }}
                >
                  <Text style={styles.finishButtonText}>Ver Propuesta en la Asamblea</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>📥 Proponer Ingreso Familiar</Text>
                  <TouchableOpacity onPress={() => setShowIngresoModal(false)}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.instructionText}>
                  Invita a un familiar a unirse a la mutual. No requiere cuenta previa; se generará un enlace válido por 15 días.
                </Text>

                {/* Nombre del candidato */}
                <Text style={styles.inputLabel}>Nombre Completo del Familiar *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ej: Carlos Andrés Pérez"
                  placeholderTextColor="#64748b"
                  value={candidateName}
                  onChangeText={setCandidateName}
                />

                {/* Parentesco */}
                <Text style={styles.inputLabel}>Parentesco o Vínculo Familiar</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ej: Hermano, Hija, Tío, Primo..."
                  placeholderTextColor="#64748b"
                  value={candidateRelation}
                  onChangeText={setCandidateRelation}
                />

                {/* Teléfono opcional */}
                <Text style={styles.inputLabel}>Teléfono / WhatsApp (Opcional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ej: +58 412 1234567"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={candidatePhone}
                  onChangeText={setCandidatePhone}
                />

                {/* Justificación */}
                <Text style={styles.inputLabel}>Justificación para la mutual *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Explica a la familia por qué este candidato debe unirse a la mutual..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={3}
                  value={justificacionIngreso}
                  onChangeText={setJustificacionIngreso}
                />

                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerText}>
                    {theme.isQA
                      ? 'ℹ️ Proceso (QA): 1 día de debate + 1 día de votación. Se aprueba con supermayoría del 75% y consenso con veto. Tu familiar tendrá 15 días para canjear el enlace.'
                      : 'ℹ️ Proceso: 4 días de debate + 3 días de votación. Se aprueba con supermayoría del 75% y consenso con veto. Tu familiar tendrá 15 días para canjear el enlace.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleProponerIngreso}
                  disabled={submittingIngreso}
                >
                  {submittingIngreso ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Crear Propuesta</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setShowIngresoModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL PROPONER EXPULSIÓN                                 */}
      {/* ======================================================== */}
      <Modal visible={showExpulsionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: '#f43f5e' }]}>⚠️ Proponer Expulsión</Text>
                <TouchableOpacity onPress={() => setShowExpulsionModal(false)}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.instructionText}>
                Selecciona al miembro activo que deseas someter al proceso de expulsión:
              </Text>

              {/* Lista de expulsables */}
              <View style={styles.candidatosList}>
                {expulsables.length === 0 ? (
                  <Text style={styles.emptyListText}>No hay miembros disponibles para proponer expulsión.</Text>
                ) : (
                  expulsables.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.candidatoItem,
                        selectedExpulsableId === m.id && styles.candidatoItemSelected
                      ]}
                      onPress={() => setSelectedExpulsableId(m.id)}
                    >
                      <View>
                        <Text style={styles.candidatoName}>{m.first_name} {m.last_name}</Text>
                        <Text style={styles.candidatoEmail}>{m.email}</Text>
                      </View>
                      <View style={[styles.radioCircle, selectedExpulsableId === m.id && styles.radioCircleSelected]} />
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Motivo */}
              <Text style={styles.inputLabel}>Motivo fundamentado de expulsión:</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Detalla los motivos objetivos (incumplimiento reiterado, falta a los acuerdos, etc.)..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={4}
                value={motivoExpulsion}
                onChangeText={setMotivoExpulsion}
              />

              <View style={[styles.infoBanner, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}>
                <Text style={[styles.infoBannerText, { color: '#fca5a5' }]}>
                  {theme.isQA
                    ? '⚠️ Garantía de defensa (QA): Inicia con 1 día de debate donde el acusado presentará sus descargos, seguidos de 1 día de votación (75% requerido).'
                    : '⚠️ Garantía de defensa: Inicia con 10 días de debate donde el acusado presentará sus descargos, seguidos de 4 días de votación (75% requerido).'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#e11d48' }]}
                onPress={handleProponerExpulsion}
                disabled={submittingExpulsion}
              >
                {submittingExpulsion ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Someter Expulsión a Asamblea</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowExpulsionModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Visor de Imágenes / Adjuntos */}
      <Modal 
        visible={receiptViewerVisible} 
        animationType="fade" 
        transparent={true}
        onRequestClose={() => setReceiptViewerVisible(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.receiptModalTitle} numberOfLines={1}>
                  {selectedReceipt?.title || 'Adjunto de la Asamblea'}
                </Text>
                {selectedReceipt?.author && (
                  <Text style={styles.receiptModalSubtitle}>
                    Publicado por: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{selectedReceipt.author}</Text>
                  </Text>
                )}
                {selectedReceipt?.date && (
                  <Text style={styles.receiptModalRef}>
                    {new Date(selectedReceipt.date).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.receiptCloseBtn}
                onPress={() => setReceiptViewerVisible(false)}
              >
                <Text style={styles.receiptCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.receiptImageContainer}>
              {imageLoading && (
                <View style={styles.receiptImageLoader}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 13 }}>Cargando imagen...</Text>
                </View>
              )}
              {imageError ? (
                <View style={styles.receiptErrorContainer}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
                  <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 14 }}>No se pudo cargar la imagen previa</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    Puedes abrir el adjunto directamente en tu navegador o visor externo.
                  </Text>
                </View>
              ) : (
                selectedReceipt?.url && (
                  <Image
                    source={{ uri: selectedReceipt.url }}
                    style={styles.receiptImage}
                    resizeMode="contain"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                  />
                )
              )}
            </View>

            <View style={styles.receiptModalFooter}>
              {selectedReceipt?.url && (
                <TouchableOpacity 
                  style={styles.receiptExternalBtn}
                  onPress={() => {
                    if (selectedReceipt?.url) {
                      Linking.openURL(selectedReceipt.url);
                    }
                  }}
                >
                  <Text style={styles.receiptExternalBtnText}>🔗 Abrir completo en navegador</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.receiptDismissBtn}
                onPress={() => setReceiptViewerVisible(false)}
              >
                <Text style={styles.receiptDismissBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// ESTILOS
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f172a'
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  proposeAdmissionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6
  },
  admissionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  },
  proposeExpulsionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6
  },
  expulsionButtonText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14
  },
  buttonIcon: {
    fontSize: 16
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: '#334155'
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  proposalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  metaHighlight: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  timerText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600'
  },
  voteSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  voteCounter: {
    flexDirection: 'row',
    gap: 12
  },
  voteCounterText: {
    color: '#cbd5e1',
    fontSize: 13
  },
  myVoteBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  myVoteText: {
    color: '#e2e8f0',
    fontSize: 11
  },
  vetoBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  vetoBannerText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600'
  },
  cardFooter: {
    alignItems: 'flex-end',
    marginTop: 4
  },
  viewDetailText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  modalOverlayShifted: {
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'android' ? 35 : 55,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    padding: 4
  },
  phaseAlert: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  phaseAlertTitle: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 15
  },
  phaseAlertSub: {
    color: '#93c5fd',
    fontSize: 13,
    marginTop: 2
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6
  },
  sectionBody: {
    color: '#f1f5f9',
    fontSize: 14,
    lineHeight: 20
  },
  proposerNote: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic'
  },
  defenseQuoteBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    marginTop: 6
  },
  defenseQuoteText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontStyle: 'italic'
  },
  noDefenseText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4
  },
  voteStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10
  },
  voteStatBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  voteStatVal: {
    fontSize: 20,
    fontWeight: '800'
  },
  voteStatLbl: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  ruleNote: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6
  },
  votingActionContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  votingHeader: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  voteButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  voteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  voteBtnSi: {
    backgroundColor: '#065f46',
    borderColor: '#10b981'
  },
  voteBtnNo: {
    backgroundColor: '#881337',
    borderColor: '#ef4444'
  },
  voteBtnAbstain: {
    backgroundColor: '#1e293b',
    borderColor: '#475569'
  },
  voteBtnSelected: {
    borderWidth: 3
  },
  voteBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  debateNoticeBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  debateNoticeTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700'
  },
  debateNoticeSub: {
    color: '#fef3c7',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18
  },
  emptyVotersText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4
  },
  voterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  voterName: {
    color: '#e2e8f0',
    fontSize: 13
  },
  voterPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  voterPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  closeProposalButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10
  },
  closeProposalButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 14
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12
  },
  candidatosList: {
    maxHeight: 180,
    marginBottom: 14
  },
  emptyListText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16
  },
  candidatoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  candidatoItemSelected: {
    borderColor: '#0284c7',
    backgroundColor: 'rgba(2, 132, 199, 0.15)'
  },
  candidatoName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600'
  },
  candidatoEmail: {
    color: '#64748b',
    fontSize: 12
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b'
  },
  radioCircleSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#0284c7'
  },
  formInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12
  },
  admissionSnippetContainer: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    padding: 10,
    marginTop: 8,
    marginBottom: 8
  },
  admissionRelationText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 6
  },
  inviteSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  inviteSnippetCodePill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  inviteSnippetCodeText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1
  },
  shareSnippetBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  shareSnippetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12
  },
  redeemedText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  pendingClaimText: {
    color: '#f59e0b',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2
  },
  pendingAssemblyText: {
    color: '#38bdf8',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 3
  },
  detailInviteBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0284c7',
    alignItems: 'center'
  },
  detailInviteCode: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4
  },
  detailInviteSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center'
  },
  successModalContainer: {
    alignItems: 'center',
    paddingVertical: 16
  },
  successBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  successModalTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8
  },
  successModalSubtext: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 10
  },
  inviteShareBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0284c7',
    padding: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  inviteShareBoxLabel: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6
  },
  inviteShareBoxCode: {
    color: '#38bdf8',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8
  },
  inviteBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  inviteValidityBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden'
  },
  inviteGovBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden'
  },
  whatsappShareButton: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  whatsappShareButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  copyCodeButton: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  copyCodeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  finishButton: {
    width: '100%',
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  textArea: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 12
  },
  infoBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginBottom: 12
  },
  infoBannerText: {
    color: '#7dd3fc',
    fontSize: 12,
    lineHeight: 16
  },
  pendingAssemblyBoxModal: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0284c7',
    padding: 16,
    marginBottom: 16
  },
  pendingAssemblyBoxTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6
  },
  pendingAssemblyBoxText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18
  },
  forumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  emptyCommentsBox: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  emptyCommentsText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  commentCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  myCommentCard: {
    borderColor: '#0284c7'
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  commentAuthor: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  myCommentBadge: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600'
  },
  stanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  stanceBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  commentContent: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6
  },
  commentImageAttachment: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 6
  },
  commentDate: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'right'
  },
  addCommentBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12
  },
  addCommentLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8
  },
  stancePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  stancePill: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  stancePillSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  stancePillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  stancePillTextSelected: {
    color: '#ffffff',
    fontWeight: '700'
  },
  commentTextInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 65,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 8
  },
  attachmentThumb: {
    width: 36,
    height: 36,
    borderRadius: 4
  },
  attachmentLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1
  },
  removeAttachmentText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600'
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  attachButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8
  },
  attachButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  sendCommentButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center'
  },
  sendCommentButtonDisabled: {
    opacity: 0.5
  },
  sendCommentButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  commentImageTouchable: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageTapHint: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  imageTapHintText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
  replyCommentBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  replyCommentBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyingText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
  },
  replyingAuthor: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  cancelReplyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cancelReplyText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  refreshForumBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshForumBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  mentionHighlight: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 15,
  },
  receiptModalCard: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  receiptModalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptModalSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  receiptModalRef: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  receiptCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCloseText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptImageContainer: {
    height: 380,
    backgroundColor: '#0a0f1d',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  receiptImageLoader: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptModalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  receiptExternalBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  receiptExternalBtnText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptDismissBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  receiptDismissBtnText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  }
});
