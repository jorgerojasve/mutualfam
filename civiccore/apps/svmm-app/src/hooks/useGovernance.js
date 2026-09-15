import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

export const useGovernance = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/governance/proposals');
      setProposals(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  return { proposals, loading, error, refetch: fetchProposals };
};
