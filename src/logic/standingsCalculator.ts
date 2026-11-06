import type { Participant, ParticipantStanding, Match, Tournament } from '../types/tournament';

export const standingsCalculator = {
  calculateStandings: (
    participants: Participant[],
    matches: Match[],
    config?: Tournament['config']
  ): ParticipantStanding[] => {
    const rows = new Map<string, ParticipantStanding>();
    for (const participant of participants) {
      rows.set(participant.id, {
        participantId: participant.id,
        points: 0,
        goalDiff: 0,
        wins: 0,
        matchesPlayed: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsAgainst: 0
      });
    }

    for (const match of matches) {
      if (match.status !== 'COMPLETED' || !match.participant1Id || !match.participant2Id) continue;
      const one = rows.get(match.participant1Id);
      const two = rows.get(match.participant2Id);
      if (!one || !two) continue;
      one.matchesPlayed!++;
      two.matchesPlayed!++;
      one.goalsScored! += match.score1;
      one.goalsAgainst! += match.score2;
      two.goalsScored! += match.score2;
      two.goalsAgainst! += match.score1;
      one.goalDiff = one.goalsScored! - one.goalsAgainst!;
      two.goalDiff = two.goalsScored! - two.goalsAgainst!;
      if (match.score1 > match.score2) {
        one.wins++;
        two.losses!++;
        one.points += config?.pointsWin ?? 3;
        two.points += config?.pointsLoss ?? 0;
      } else if (match.score2 > match.score1) {
        two.wins++;
        one.losses!++;
        two.points += config?.pointsWin ?? 3;
        one.points += config?.pointsLoss ?? 0;
      } else {
        one.draws!++;
        two.draws!++;
        one.points += config?.pointsDraw ?? 1;
        two.points += config?.pointsDraw ?? 1;
      }
    }

    const criteria = config?.tieBreakers ?? ['goalDiff', 'goalsScored'];
    const compareHeadToHead = (aId: string, bId: string) => {
      const directMatches = matches.filter(match => match.status === 'COMPLETED' &&
        ((match.participant1Id === aId && match.participant2Id === bId) ||
         (match.participant1Id === bId && match.participant2Id === aId)));
      let aPoints = 0;
      let bPoints = 0;
      let aDiff = 0;
      let bDiff = 0;
      for (const match of directMatches) {
        const one = match.participant1Id === aId ? match.score1 : match.score2;
        const two = match.participant1Id === bId ? match.score1 : match.score2;
        aDiff += one - two;
        bDiff += two - one;
        if (one > two) aPoints += config?.pointsWin ?? 3;
        else if (two > one) bPoints += config?.pointsWin ?? 3;
        else {
          aPoints += config?.pointsDraw ?? 1;
          bPoints += config?.pointsDraw ?? 1;
        }
      }
      return bPoints - aPoints || bDiff - aDiff;
    };

    return [...rows.values()].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      for (const criterion of criteria) {
        let difference = 0;
        switch (criterion) {
          case 'goalDiff': difference = b.goalDiff - a.goalDiff; break;
          case 'goalsScored': difference = (b.goalsScored ?? 0) - (a.goalsScored ?? 0); break;
          case 'wins': difference = b.wins - a.wins; break;
          case 'headToHead': difference = compareHeadToHead(a.participantId, b.participantId); break;
          case 'organizerDecision': {
            const order = config?.standingOrder ?? [];
            difference = (order.indexOf(a.participantId) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(a.participantId)) -
              (order.indexOf(b.participantId) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(b.participantId));
            break;
          }
          case 'randomDraw': {
            const order = config?.randomDrawOrder ?? [];
            difference = (order.indexOf(a.participantId) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(a.participantId)) -
              (order.indexOf(b.participantId) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(b.participantId));
            break;
          }
        }
        if (difference) return difference;
      }
      return a.participantId.localeCompare(b.participantId);
    });
  }
};
