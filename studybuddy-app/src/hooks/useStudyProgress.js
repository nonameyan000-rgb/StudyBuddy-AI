import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useStudyProgress(userId) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDueCards = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    // Simulate query if we have dummy keys
    if (import.meta.env.VITE_SUPABASE_URL === 'https://dummy-project.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
        const dummyCards = [
            { id: '1', front: 'Equivocate', back: 'Use ambiguous language so as to conceal the truth.' },
            { id: '2', front: 'Cacophony', back: 'A harsh, discordant mixture of sounds.' }
        ];
        setTimeout(() => {
            setCards(dummyCards);
            setLoading(false);
        }, 800);
        return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('study_progress')
        .select(`
          flashcard_id,
          next_review_date,
          flashcards ( id, front, back )
        `)
        .eq('user_id', userId)
        .lte('next_review_date', today);

      if (error) {
        throw error;
      }
      
      const mappedCards = (data || []).map(item => item.flashcards).filter(Boolean);
      setCards(mappedCards);
    } catch (err) {
      console.warn("Falling back to local state due to error: ", err.message);
      // Fallback if real query fails
      setCards([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  return { cards, loading, error, refresh: fetchDueCards };
}
