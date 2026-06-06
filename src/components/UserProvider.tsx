"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string;
  role: 'student' | 'admin';
  balance: number;
};

export type BetSelection = {
  matchId: string;
  matchName: string;
  market: string;
  outcomeName: string;
  odd: number;
};

type UserContextType = {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  selections: BetSelection[];
  addSelection: (sel: BetSelection) => void;
  removeSelection: (matchId: string, market: string) => void;
  clearSelections: () => void;
  isBetslipOpen: boolean;
  setIsBetslipOpen: (open: boolean) => void;
};

const UserContext = createContext<UserContextType>({ 
  profile: null, 
  loading: true, 
  refreshProfile: async () => {},
  selections: [],
  addSelection: () => {},
  removeSelection: () => {},
  clearSelections: () => {},
  isBetslipOpen: false,
  setIsBetslipOpen: () => {}
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Betslip Global State
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);

  const fetchProfile = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      await supabase.auth.signOut();
    }

    if (session?.user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  const addSelection = (sel: BetSelection) => {
    setSelections((prev) => {
      const exists = prev.find(
        (s) => s.matchId === sel.matchId && s.market === sel.market
      );
      if (exists) {
        if (exists.outcomeName === sel.outcomeName) {
          // Toggle off if the exact same selection is clicked
          return prev.filter(
            (s) => !(s.matchId === sel.matchId && s.market === sel.market)
          );
        } else {
          // Replace outcome if same match and market, but different outcome
          return prev.map((s) =>
            s.matchId === sel.matchId && s.market === sel.market ? sel : s
          );
        }
      }
      return [...prev, sel];
    });
  };

  const removeSelection = (matchId: string, market: string) => {
    setSelections((prev) =>
      prev.filter((s) => !(s.matchId === matchId && s.market === market))
    );
  };

  const clearSelections = () => {
    setSelections([]);
  };

  useEffect(() => {
    fetchProfile();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ 
      profile, loading, refreshProfile: fetchProfile,
      selections, addSelection, removeSelection, clearSelections,
      isBetslipOpen, setIsBetslipOpen
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

