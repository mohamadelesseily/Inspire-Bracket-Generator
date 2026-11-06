import type { Participant, Group, Match } from '../types/tournament';

const shuffle = <T,>(values: T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const groupLogic = {
  generateGroups: (participants: Participant[], groupSize = 4): Group[] => {
    if (!Number.isInteger(groupSize) || groupSize < 2) return [];
    const shuffled = shuffle(participants);
    const groupCount = Math.ceil(shuffled.length / groupSize);
    const groups: Group[] = Array.from({ length: groupCount }, (_, index) => ({
      id: `group-${index + 1}`,
      name: `Group ${String.fromCharCode(65 + index)}`,
      participantIds: [],
      standings: []
    }));
    shuffled.forEach((participant, index) => groups[index % groupCount].participantIds.push(participant.id));
    return groups;
  },

  generateGroupMatches: (groupId: string, participantIds: string[], matchesPerParticipant = 2): Match[] => {
    if (participantIds.length < 2 || matchesPerParticipant < 1) return [];
    const players = shuffle(participantIds);
    const circle: (string | null)[] = [...players];
    if (circle.length % 2) circle.push(null);
    const played = new Set<string>();
    const counts = new Map(participantIds.map(id => [id, 0]));
    const matches: Match[] = [];
    const maxRounds = circle.length - 1;

    for (let round = 0; round < maxRounds && [...counts.values()].some(count => count < matchesPerParticipant); round++) {
      for (let i = 0; i < circle.length / 2; i++) {
        const a = circle[i];
        const b = circle[circle.length - 1 - i];
        if (!a || !b || counts.get(a)! >= matchesPerParticipant || counts.get(b)! >= matchesPerParticipant) continue;
        const key = [a, b].sort().join(':');
        if (played.has(key)) continue;
        played.add(key);
        counts.set(a, counts.get(a)! + 1);
        counts.set(b, counts.get(b)! + 1);
        matches.push({
          id: `match-${groupId}-${matches.length + 1}`,
          round: round + 1,
          position: matches.length,
          participant1Id: a,
          participant2Id: b,
          score1: 0,
          score2: 0,
          winnerId: null,
          status: 'SCHEDULED',
          nextMatchId: null,
          bracketType: 'UPPER'
        });
      }
      const last = circle.pop()!;
      circle.splice(1, 0, last);
    }
    return matches;
  }
};
