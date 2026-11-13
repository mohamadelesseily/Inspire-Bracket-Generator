export type Role = 'ORGANIZER' | 'VIEWER';
export type TournamentFormat = 'GROUP_SINGLE' | 'SINGLE_ELIM' | 'DOUBLE_ELIM';
export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
export type BracketType = 'UPPER' | 'LOWER' | 'FINAL' | 'FINAL_RESET';

export interface Participant {
  id: string;
  name: string;
  seed?: number;
  points: number;
  wins: number;
  losses: number;
}

export interface ParticipantStanding {
  participantId: string;
  points: number;
  goalDiff: number;
  wins: number;
  matchesPlayed?: number;
  draws?: number;
  losses?: number;
  goalsScored?: number;
  goalsAgainst?: number;
}

export interface Group {
  id: string;
  name: string;
  participantIds: string[];
  standings: ParticipantStanding[];
}

export interface Match {
  id: string;
  round: number;
  position: number;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number;
  score2: number;
  winnerId: string | null;
  status: MatchStatus;
  nextMatchId: string | null;
  loserNextMatchId?: string | null;
  loserNextSlot?: 1 | 2;
  bracketType?: BracketType;
  manuallyEdited?: boolean;
  manualWinnerId?: string | null;
  scheduleRoundLabel?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  screenNumber?: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: 'DRAFT' | 'LIVE' | 'FINISHED';
  participants: Participant[];
  groups: Group[];
  groupMatches?: Match[];
  bracket: Match[];
  qualifiedParticipantIds?: string[];
  qualificationOverrides?: string[];
  config: {
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    tieBreakers: string[];
    groupSize?: number;
    matchesPerParticipant?: number;
    qualifiersPerGroup?: number;
    bestThirdPlaceQualifiers?: number;
    bracketSeeding?: 'RANDOM' | 'SEEDED';
    standingOrder?: string[];
    randomDrawOrder?: string[];
  };
}
