import type { Tournament } from '../types/tournament';

const STORAGE_KEY = 'tournament_mgmt_data';

export const storageService = {
  saveTournaments: (tournaments: Tournament[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  },

  loadTournaments: (): Tournament[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      const parsed: unknown = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return (parsed as Tournament[]).map(tournament => {
        if (tournament.format !== 'GROUP_SINGLE' || tournament.groupMatches) return tournament;
        const legacyGroupMatches = tournament.bracket.filter(match => match.id.includes('-group-'));
        const knockoutMatches = tournament.bracket.filter(match => !match.id.includes('-group-'));
        return {
          ...tournament,
          groupMatches: legacyGroupMatches,
          bracket: knockoutMatches
        };
      });
    } catch {
      return [];
    }
  },

  saveTournament: (tournament: Tournament) => {
    const tournaments = storageService.loadTournaments();
    const index = tournaments.findIndex(t => t.id === tournament.id);
    if (index !== -1) {
      tournaments[index] = tournament;
    } else {
      tournaments.push(tournament);
    }
    storageService.saveTournaments(tournaments);
  },

  deleteTournament: (id: string) => {
    const tournaments = storageService.loadTournaments().filter(t => t.id !== id);
    storageService.saveTournaments(tournaments);
  },

  getTournament: (id: string): Tournament | null => {
    return storageService.loadTournaments().find(t => t.id === id) || null;
  }
};
