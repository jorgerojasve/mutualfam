import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import theme from '../utils/theme';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (_) {}
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (_) {}
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.icon}>⚠️</Text>
              <Text style={styles.title}>Algo no salió como esperábamos</Text>
              <Text style={styles.subtitle}>
                Mutual Familiar se recuperó de un problema inesperado para proteger tu sesión y tus datos.
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>Volver a intentar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailsToggle}
                onPress={() => this.setState({ showDetails: !this.state.showDetails })}
                activeOpacity={0.7}
              >
                <Text style={styles.detailsToggleText}>
                  {this.state.showDetails ? 'Ocultar detalles técnicos ▲' : 'Ver detalles técnicos ▼'}
                </Text>
              </TouchableOpacity>

              {this.state.showDetails && (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsErrorText}>
                    {this.state.error?.toString() || 'Error desconocido'}
                  </Text>
                  {this.state.errorInfo?.componentStack && (
                    <Text style={styles.detailsStackText}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.screenBg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.accent,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailsToggle: {
    marginTop: 16,
    paddingVertical: 8,
  },
  detailsToggleText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  detailsBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsErrorText: {
    color: '#f87171',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 6,
  },
  detailsStackText: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
