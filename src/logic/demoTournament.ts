import { v4 as uuidv4 } from 'uuid';
import { bracketLogic } from './bracketGenerator';
import { groupLogic } from './groupGenerator';
import { qualifyGroupParticipants } from './qualification';
import type { Match, Participant, Tournament } from '../types/tournament';

export const DEMO_TOURNAMENT_NAME = '48-Team Demo: Groups + Single Elimination';

export const createDemoTournament = (): Tournament => {
  const id = uuidv4();
  const participants: Participant[] = Array.from({ length: 48 }, (_, index) => ({
    id: uuidv4(),
    name: `Demo Team ${String(index + 1).padStart(2, '0')}`,
    seed: index + 1,
    points: 0,
    wins: 0,
    losses: 0
  }));
  const groups = groupLogic.generateGroups(participants, 4);
  const groupMatches: Match[] = groups.flatMap(group =>
    groupLogic.generateGroupMatches(group.id, group.participantIds, 3).map(match => {
      // Give the demo a complete, varied group stage so standings and qualification
      // can be inspected immediately, while leaving the knockout ready to play.
      const score1 = (match.position + match.round) % 4;
      const score2 = (match.position * 2 + match.round + 1) % 4;
      return {
        ...match,
        score1,
        score2,
        winnerId: score1 === score2 ? null : score1 > score2 ? match.participant1Id : match.participant2Id,
        status: 'COMPLETED' as const
      };
    })
  );
  const tournament: Tournament = {
    id,
    name: DEMO_TOURNAMENT_NAME,
    format: 'GROUP_SINGLE',
    status: 'LIVE',
    participants,
    groups,
    groupMatches,
    bracket: [],
    config: {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tieBreakers: ['goalDiff', 'goalsScored', 'headToHead'],
      groupSize: 4,
      matchesPerParticipant: 3,
      qualifiersPerGroup: 2,
      bestThirdPlaceQualifiers: 8,
      bracketSeeding: 'SEEDED',
      randomDrawOrder: participants.map(participant => participant.id)
    }
  };
  const qualifiedParticipantIds = qualifyGroupParticipants(tournament);
  tournament.qualifiedParticipantIds = qualifiedParticipantIds;
  tournament.bracket = bracketLogic.generateSingleElimination(
    qualifiedParticipantIds.map(participantId => participants.find(participant => participant.id === participantId)!),
    id
  );
  return tournament;
};
