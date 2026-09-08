import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

export const usePayments = (memberId = 1) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/payments/transactions/${memberId}`);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [memberId]);

  return { transactions, loading, error, refetch: fetchTransactions };
};
