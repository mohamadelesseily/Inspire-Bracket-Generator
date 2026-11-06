import type { Group, Match, Participant, Tournament } from '../types/tournament';
import { standingsCalculator } from './standingsCalculator';

export const getGroupStandings = (group: Group, participants: Participant[], matches: Match[], tournament: Tournament) =>
  standingsCalculator.calculateStandings(
    participants.filter(participant => group.participantIds.includes(participant.id)),
    matches.filter(match => match.id.startsWith(`match-${group.id}-`)),
    tournament.config
  );

export const getBestThirdPlaceQualifierCount = (groupCount: number, qualifiersPerGroup: number) => {
  if (groupCount < 1 || qualifiersPerGroup !== 2) return 0;
  const directCount = groupCount * qualifiersPerGroup;
  const targetCount = 2 ** Math.ceil(Math.log2(directCount));
  const needed = targetCount - directCount;
  return needed <= groupCount ? needed : 0;
};

export const rankThirdPlaceParticipants = (tournament: Tournament) => {
  const thirdPlaces = tournament.groups.flatMap(group => {
    const standing = getGroupStandings(group, tournament.participants, tournament.groupMatches ?? [], tournament)[2];
    return standing ? [{ groupId: group.id, groupName: group.name, standing }] : [];
  });
  const tieBreakers = (tournament.config.tieBreakers ?? []).filter(rule => rule !== 'headToHead');
  const order = tournament.config.standingOrder ?? [];
  const randomOrder = tournament.config.randomDrawOrder ?? [];
  const compare = (a: typeof thirdPlaces[number], b: typeof thirdPlaces[number]) => {
    const left = a.standing;
    const right = b.standing;
    if (left.points !== right.points) return right.points - left.points;
    for (const rule of tieBreakers) {
      if (rule === 'goalDiff' && left.goalDiff !== right.goalDiff) return right.goalDiff - left.goalDiff;
      if (rule === 'goalsScored' && left.goalsScored !== right.goalsScored) return (right.goalsScored ?? 0) - (left.goalsScored ?? 0);
      if (rule === 'wins' && left.wins !== right.wins) return right.wins - left.wins;
      if (rule === 'organizerDecision') {
        const difference = order.indexOf(left.participantId) - order.indexOf(right.participantId);
        if (difference) return difference;
      }
      if (rule === 'randomDraw') {
        const difference = randomOrder.indexOf(left.participantId) - randomOrder.indexOf(right.participantId);
        if (difference) return difference;
      }
    }
    return left.participantId.localeCompare(right.participantId);
  };
  return thirdPlaces.sort(compare).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    qualifies: index < getBestThirdPlaceQualifierCount(tournament.groups.length, tournament.config.qualifiersPerGroup ?? 2)
  }));
};

export const qualifyGroupParticipants = (tournament: Tournament) => {
  const directCount = tournament.config.qualifiersPerGroup ?? 2;
  const thirdCount = getBestThirdPlaceQualifierCount(tournament.groups.length, directCount);
  const standings = tournament.groups.map(group => ({
    group,
    rows: getGroupStandings(group, tournament.participants, tournament.groupMatches ?? [], tournament)
  }));
  const direct = Array.from({ length: directCount }, (_, place) =>
    standings.flatMap(({ rows }) => rows[place] ? [rows[place].participantId] : [])
  ).flat();
  if (directCount < 1) return [];
  if (thirdCount === 0) return direct;

  const directIds = new Set(direct);
  const orderedThirds = rankThirdPlaceParticipants(tournament).filter(entry => !directIds.has(entry.standing.participantId));
  return [...new Set([...direct, ...orderedThirds.slice(0, thirdCount).map(entry => entry.standing.participantId)])];
};

export const groupMatchesComplete = (tournament: Tournament) => {
  const matches = tournament.groupMatches ?? [];
  return matches.length > 0 && matches.every(match => match.status === 'COMPLETED');
};
