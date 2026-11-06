import { create } from 'zustand';
import type { Tournament, Role } from '../types/tournament';
import { storageService } from '../services/storage';

interface TournamentState {
  tournaments: Tournament[];
  currentTournamentId: string | null;
  userRole: Role;

  setRole: (role: Role) => void;
  loadTournaments: () => void;
  setCurrentTournament: (id: string | null) => void;
  addTournament: (tournament: Tournament) => void;
  updateTournament: (tournament: Tournament) => void;
  deleteTournament: (id: string) => void;
}

export const useTournamentStore = create<TournamentState>((set) => ({
  tournaments: storageService.loadTournaments(),
  currentTournamentId: null,
  userRole: (localStorage.getItem('tournament_user_role') as Role | null) ?? 'VIEWER',

  setRole: (role) => {
    localStorage.setItem('tournament_user_role', role);
    set({ userRole: role });
  },

  loadTournaments: () => {
    const tournaments = storageService.loadTournaments();
    set({ tournaments });
  },

  setCurrentTournament: (id) => set({ currentTournamentId: id }),

  addTournament: (tournament) => {
    set((state) => {
      const newTournaments = [...state.tournaments, tournament];
      storageService.saveTournaments(newTournaments);
      return { tournaments: newTournaments };
    });
  },

  updateTournament: (tournament) => {
    set((state) => {
      const newTournaments = state.tournaments.map(t => t.id === tournament.id ? tournament : t);
      storageService.saveTournaments(newTournaments);
      return { tournaments: newTournaments };
    });
  },

  deleteTournament: (id) => {
    set((state) => {
      const newTournaments = state.tournaments.filter(t => t.id !== id);
      storageService.saveTournaments(newTournaments);
      return { tournaments: newTournaments };
    });
  },
}));
