import type { Participant, Match } from '../types/tournament';

export const isPowerOfTwoBracketSize = (count: number) =>
  Number.isInteger(count) && count >= 2 && Number.isInteger(Math.log2(count));

export const bracketSizeGuidance = (count: number) => {
  if (count < 2) return 'A knockout bracket needs at least 2 participants.';
  if (isPowerOfTwoBracketSize(count)) return `${count} participants form a complete bracket.`;
  const lower = 2 ** Math.floor(Math.log2(count));
  const upper = lower * 2;
  return `A complete bracket needs 2, 4, 8, 16, 32, or 64 participants. Adjust this field to ${lower} or ${upper}.`;
};
const matchId = (tournamentId: string, bracket: string, round: number, position: number) =>
  `match-${tournamentId}-${bracket}-r${round}-${position}`;

const createMatch = (
  tournamentId: string,
  bracket: string,
  round: number,
  position: number,
  type: Match['bracketType'],
  nextMatchId: string | null = null
): Match => ({
  id: matchId(tournamentId, bracket, round, position),
  round,
  position,
  participant1Id: null,
  participant2Id: null,
  score1: 0,
  score2: 0,
  winnerId: null,
  status: 'SCHEDULED',
  nextMatchId,
  bracketType: type
});

export const bracketLogic = {
  generateSingleElimination: (participants: Participant[], tournamentId: string): Match[] => {
    if (!isPowerOfTwoBracketSize(participants.length)) return [];
    const size = participants.length;
    const rounds = Math.log2(size);
    const matches: Match[] = [];
    for (let round = 1; round <= rounds; round++) {
      const count = size / 2 ** round;
      for (let position = 0; position < count; position++) {
        const next = round < rounds ? matchId(tournamentId, 'upper', round + 1, Math.floor(position / 2)) : null;
        matches.push(createMatch(tournamentId, 'upper', round, position, 'UPPER', next));
      }
    }
    const firstRound = matches.filter(match => match.round === 1);
    firstRound.forEach((match, index) => {
      match.participant1Id = participants[index * 2].id;
      match.participant2Id = participants[index * 2 + 1].id;
    });
    return matches;
  },

  generateDoubleElimination: (participants: Participant[], tournamentId: string): Match[] => {
    if (!isPowerOfTwoBracketSize(participants.length)) return [];
    const size = participants.length;
    const rounds = Math.log2(size);
    const matches: Match[] = [];
    for (let round = 1; round <= rounds; round++) {
      const count = size / 2 ** round;
      for (let position = 0; position < count; position++) {
        const next = round < rounds ? matchId(tournamentId, 'upper', round + 1, Math.floor(position / 2)) : null;
        matches.push(createMatch(tournamentId, 'upper', round, position, 'UPPER', next));
      }
    }
    matches.filter(match => match.bracketType === 'UPPER' && match.round === 1).forEach((match, index) => {
      match.participant1Id = participants[index * 2].id;
      match.participant2Id = participants[index * 2 + 1].id;
    });

    const lowerRoundCounts: number[] = [];
    for (let round = 1; round < rounds * 2 - 1; round++) {
      lowerRoundCounts.push(size / 2 ** (Math.floor((round - 1) / 2) + 2));
    }
    lowerRoundCounts.forEach((count, index) => {
      const round = index + 1;
      for (let position = 0; position < count; position++) {
        const next = round < lowerRoundCounts.length
          ? matchId(tournamentId, 'lower', round + 1, round % 2 === 1 ? position : Math.floor(position / 2))
          : matchId(tournamentId, 'final', 1, 0);
        matches.push(createMatch(tournamentId, 'lower', round, position, 'LOWER', next));
      }
    });
    if (rounds === 1) {
      matches.push(createMatch(tournamentId, 'lower', 1, 0, 'LOWER'));
    }

    for (const upperRound of matches.filter(match => match.bracketType === 'UPPER')) {
      const dropRound = upperRound.round === 1 ? 1 : 2 * upperRound.round - 2;
      const dropPosition = upperRound.round === 1 ? Math.floor(upperRound.position / 2) : upperRound.position;
      const target = matches.find(match => match.bracketType === 'LOWER' && match.round === dropRound && match.position === dropPosition);
      if (target) {
        upperRound.loserNextMatchId = target.id;
        upperRound.loserNextSlot = upperRound.round === 1 ? (upperRound.position % 2 === 0 ? 1 : 2) : 2;
      }
    }

    const upperFinal = matches.find(match => match.bracketType === 'UPPER' && match.round === rounds);
    const lowerFinal = matches.filter(match => match.bracketType === 'LOWER').sort((a, b) => b.round - a.round)[0];
    const grandFinal = createMatch(tournamentId, 'final', 1, 0, 'FINAL');
    grandFinal.participant1Id = upperFinal?.winnerId ?? null;
    grandFinal.participant2Id = lowerFinal?.winnerId ?? null;
    if (upperFinal) upperFinal.nextMatchId = grandFinal.id;
    if (lowerFinal) lowerFinal.nextMatchId = grandFinal.id;
    matches.push(grandFinal);

    // Every upper round starts without a result except automatic first-round byes.
    return recalculateBracket(matches);
  },

  recalculate: recalculateBracket
};

export const editOpeningMatch = (matches: Match[], matchId: string, slot: 1 | 2, participantId: string | null): Match[] => {
  const target = matches.find(match => match.id === matchId && match.round === 1 && match.bracketType === 'UPPER');
  if (!target) return matches;
  const result = matches.map(match => ({ ...match }));
  const edited = result.find(match => match.id === matchId)!;
  const displacedId = slot === 1 ? edited.participant1Id : edited.participant2Id;
  if (participantId === displacedId || (!participantId && displacedId)) return matches;
  const source = participantId ? result.find(match => match.round === 1 && match.bracketType === 'UPPER' &&
    (match.participant1Id === participantId || match.participant2Id === participantId)) : undefined;
  if (source) {
    if (source.participant1Id === participantId) source.participant1Id = displacedId;
    else source.participant2Id = displacedId;
    source.manuallyEdited = true;
  }
  if (slot === 1) edited.participant1Id = participantId;
  else edited.participant2Id = participantId;
  for (const match of result.filter(item => item.round === 1 && item.bracketType === 'UPPER')) {
    match.score1 = 0;
    match.score2 = 0;
    match.manualWinnerId = null;
    match.manuallyEdited = match.manuallyEdited || match.id === matchId;
    if (!match.participant1Id || !match.participant2Id) {
      match.winnerId = match.participant1Id ?? match.participant2Id;
      match.status = match.winnerId ? 'COMPLETED' : 'SCHEDULED';
    } else {
      match.winnerId = null;
      match.manualWinnerId = null;
      match.status = 'SCHEDULED';
    }
  }
  return recalculateBracket(result);
};

function recalculateBracket(matches: Match[]): Match[] {
  const result = matches.map(match => ({ ...match }));
  const ordered = [...result].sort((a, b) => {
    const order = (type?: Match['bracketType']) => type === 'UPPER' ? 0 : type === 'LOWER' ? 1 : 2;
    return order(a.bracketType) - order(b.bracketType) || a.round - b.round || a.position - b.position;
  });

  for (const match of ordered) {
    if (match.bracketType === 'FINAL_RESET') continue;
    if (match.bracketType === 'UPPER' && match.round === 1) continue;
    const winnerSources = result.filter(source => source.nextMatchId === match.id);
    const loserSources = result.filter(source => source.loserNextMatchId === match.id);
    const slots: [string | null, string | null] = [null, null];
    for (const source of winnerSources) {
      const slot = match.bracketType === 'FINAL'
        ? (source.bracketType === 'LOWER' ? 1 : 0)
        : source.bracketType === 'LOWER' && source.round % 2 === 1
          ? 0
          : source.bracketType === 'LOWER' ? source.position % 2 : source.position % 2;
      if (slots[slot] == null) slots[slot] = source.winnerId;
    }
    for (const source of loserSources) {
      const slot = source.loserNextSlot === 2 ? 1 : 0;
      slots[slot] = source.status === 'COMPLETED' && source.winnerId
        ? (source.winnerId === source.participant1Id ? source.participant2Id : source.participant1Id)
        : null;
    }
    const [one, two] = slots;
    if (match.participant1Id !== one || match.participant2Id !== two) {
      match.participant1Id = one;
      match.participant2Id = two;
      match.score1 = 0;
      match.score2 = 0;
      match.winnerId = null;
      match.status = 'SCHEDULED';
    }
    if ((one && !two) || (!one && two)) {
      match.winnerId = one ?? two;
      match.status = 'COMPLETED';
    } else if (match.status === 'COMPLETED') {
      match.winnerId = match.score1 === match.score2 ? null : match.score1 > match.score2 ? one : two;
      if (match.manualWinnerId && (match.manualWinnerId === one || match.manualWinnerId === two)) match.winnerId = match.manualWinnerId;
      if (!match.winnerId) match.status = 'SCHEDULED';
    }
  }
  const reset = result.find(match => match.bracketType === 'FINAL_RESET');
  const grandFinal = result.find(match => match.bracketType === 'FINAL');
  if (reset && grandFinal && (reset.participant1Id !== grandFinal.participant1Id || reset.participant2Id !== grandFinal.participant2Id)) {
    reset.participant1Id = grandFinal.participant1Id;
    reset.participant2Id = grandFinal.participant2Id;
    reset.score1 = 0;
    reset.score2 = 0;
    reset.winnerId = null;
    reset.manualWinnerId = null;
    reset.status = 'SCHEDULED';
  }
  return result;
}
