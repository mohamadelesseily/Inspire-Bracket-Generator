import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTournamentStore } from '../store/useTournamentStore';
import { bracketLogic, bracketSizeGuidance, editOpeningMatch, isPowerOfTwoBracketSize } from '../logic/bracketGenerator';
import { Button, Card } from '../components/ui/Common';
import { ScoreStepper } from '../components/ui/ScoreStepper';
import { RoleGuard } from '../components/RoleGuard';
import type { BracketType, Match } from '../types/tournament';
import { groupMatchesComplete, qualifyGroupParticipants } from '../logic/qualification';

const bracketLabel = (type?: BracketType) => ({
  UPPER: 'Upper Bracket',
  LOWER: 'Lower Bracket',
  FINAL: 'Grand Final',
  FINAL_RESET: 'Grand Final Reset'
}[type ?? 'UPPER']);

const shuffle = <T,>(values: T[]) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

export const BracketView = () => {
  const { id } = useParams();
  const { tournaments, updateTournament, userRole } = useTournamentStore();
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, [number, number]>>({});
  const [activeRoundKey, setActiveRoundKey] = useState<string | null>(null);
  const tournament = tournaments.find(item => item.id === id);

  if (!tournament) return <div className="text-center py-20 text-accent-grey">Tournament not found.</div>;

  const handleGenerateBracket = () => {
    if (tournament.participants.length < 2) return alert('Add at least two participants before generating a bracket.');
    if (tournament.bracket.length && !window.confirm('Generating a new bracket will delete existing matches and results. Continue?')) return;
    let entrants = tournament.format === 'GROUP_SINGLE'
      ? (tournament.qualifiedParticipantIds ?? []).map(participantId => tournament.participants.find(participant => participant.id === participantId)).filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
      : [...tournament.participants];
    if (entrants.length < 2) return alert('Complete the group stage and confirm at least two qualifiers before generating the knockout bracket.');
    if (!isPowerOfTwoBracketSize(entrants.length)) return alert(bracketSizeGuidance(entrants.length));
    if (tournament.config.bracketSeeding === 'RANDOM') {
      entrants = shuffle(entrants);
    }
    const bracket = tournament.format === 'DOUBLE_ELIM'
      ? bracketLogic.generateDoubleElimination(entrants, tournament.id)
      : bracketLogic.generateSingleElimination(entrants, tournament.id);
    updateTournament({ ...tournament, bracket, status: 'DRAFT' });
  };

  const startTournament = () => {
    const expected = tournament.format === 'GROUP_SINGLE'
      ? tournament.qualifiedParticipantIds ?? []
      : tournament.participants.map(participant => participant.id);
    const opening = tournament.bracket.filter(match => match.bracketType === 'UPPER' && match.round === 1);
    const placed = new Set(opening.flatMap(match => [match.participant1Id, match.participant2Id]).filter((id): id is string => Boolean(id)));
    if (opening.length * 2 !== expected.length || placed.size !== expected.length || expected.some(participantId => !placed.has(participantId))) {
      return alert('Place every qualified participant into the opening bracket before starting.');
    }
    updateTournament({ ...tournament, status: 'LIVE' });
  };

  const commitBracket = (input: Match[], changedMatchId: string) => {
    let bracket = input;
    const current = bracket.find(match => match.id === changedMatchId);
    if (current?.bracketType === 'FINAL') {
      const resetId = `match-${tournament.id}-final-reset`;
      if (current.winnerId === current.participant2Id) {
        const final = current;
        const existingReset = bracket.find(match => match.bracketType === 'FINAL_RESET');
        const reset: Match = existingReset ? {
          ...existingReset,
          participant1Id: final.participant1Id,
          participant2Id: final.participant2Id
        } : {
          id: resetId,
          round: 2,
          position: 0,
          participant1Id: final.participant1Id,
          participant2Id: final.participant2Id,
          score1: 0,
          score2: 0,
          winnerId: null,
          status: 'SCHEDULED',
          nextMatchId: null,
          bracketType: 'FINAL_RESET'
        };
        bracket = [...bracket.filter(match => match.bracketType !== 'FINAL_RESET'), reset];
      } else {
        bracket = bracket.filter(match => match.bracketType !== 'FINAL_RESET');
      }
    }

    const reset = bracket.find(match => match.bracketType === 'FINAL_RESET');
    const grandFinal = bracket.find(match => match.bracketType === 'FINAL');
    const champion = reset
      ? reset.winnerId
      : grandFinal
        ? grandFinal.winnerId === grandFinal.participant1Id ? grandFinal.winnerId : null
        : bracket.find(match => !match.nextMatchId && match.winnerId)?.winnerId ?? null;
    updateTournament({ ...tournament, bracket, status: champion ? 'FINISHED' : 'LIVE' });
  };

  const handleUpdateScore = (matchId: string, score1: number, score2: number) => {
    const current = tournament.bracket.find(match => match.id === matchId);
    if (!current?.participant1Id || !current.participant2Id || userRole !== 'ORGANIZER') return;
    const winnerId = score1 === score2 ? null : score1 > score2 ? current.participant1Id : current.participant2Id;
    const bracket = bracketLogic.recalculate(tournament.bracket.map(match => match.id === matchId ? {
      ...match,
      score1,
      score2,
      winnerId,
      manualWinnerId: null,
      status: winnerId ? 'COMPLETED' as const : 'SCHEDULED' as const
    } : match));
    commitBracket(bracket, matchId);
  };

  const handleWinnerOverride = (matchId: string, winnerId: string | null) => {
    const current = tournament.bracket.find(match => match.id === matchId);
    if (!current || !current.participant1Id || !current.participant2Id || userRole !== 'ORGANIZER') return;
    const finalWinner = winnerId ?? (current.score1 === current.score2 ? null : current.score1 > current.score2 ? current.participant1Id : current.participant2Id);
    const bracket = bracketLogic.recalculate(tournament.bracket.map(match => match.id === matchId ? {
      ...match,
      manualWinnerId: winnerId,
      winnerId: finalWinner,
      status: finalWinner ? 'COMPLETED' as const : current.score1 === current.score2 ? 'SCHEDULED' as const : 'COMPLETED' as const
    } : match));
    commitBracket(bracket, matchId);
  };

  const knockoutHasStarted = tournament.bracket.some(match => match.status === 'COMPLETED' && match.participant1Id && match.participant2Id);
  const canEditSeeds = userRole === 'ORGANIZER' && tournament.bracket.length > 0 && !knockoutHasStarted;
  const entrants = tournament.format === 'GROUP_SINGLE'
    ? (tournament.qualifiedParticipantIds ?? [])
    : tournament.participants.map(participant => participant.id);

  const doubleElimination = tournament.format === 'DOUBLE_ELIM';
  const groupTournament = tournament.format === 'GROUP_SINGLE';
  const groupStageComplete = groupTournament && groupMatchesComplete(tournament);
  const groupQualifierCount = groupTournament ? qualifyGroupParticipants(tournament).length : 0;
  const championMatch = tournament.bracket.find(match => match.bracketType === 'FINAL_RESET') ??
    tournament.bracket.find(match => match.bracketType === 'FINAL') ??
    tournament.bracket.filter(match => !match.nextMatchId).sort((a, b) => b.round - a.round)[0];
  const championId = championMatch?.bracketType === 'FINAL' && championMatch.winnerId !== championMatch.participant1Id
    ? null : championMatch?.winnerId;
  const championName = tournament.participants.find(participant => participant.id === championId)?.name;
  const rounds = new Map<string, Match[]>();
  for (const match of tournament.bracket) {
    const key = `${match.bracketType ?? 'UPPER'}-${match.round}`;
    rounds.set(key, [...(rounds.get(key) ?? []), match]);
  }
  const columns = [...rounds.entries()].sort(([keyA], [keyB]) => {
    const order = (key: string) => key.startsWith('UPPER') ? 0 : key.startsWith('LOWER') ? 1 : 2;
    return order(keyA) - order(keyB) || Number(keyA.split('-').at(-1)) - Number(keyB.split('-').at(-1));
  });
  const activeRound = columns.find(([key]) => key === activeRoundKey) ?? columns[0];

  return (
    <div className="bracket-page max-w-full py-8 px-4">
      <div className="bracket-page-header flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          {groupTournament && <Link to={`/tournament/${tournament.id}/groups`} className="text-accent-grey hover:text-primary">← Groups</Link>}
          <div>
            <h1 className="text-4xl font-bold text-primary">{tournament.name}</h1>
            <p className="text-accent-grey">{doubleElimination ? 'Double Elimination' : 'Knockout Stage'}</p>
          </div>
        </div>
        {!tournament.bracket.length && tournament.format !== 'GROUP_SINGLE' && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button disabled={!isPowerOfTwoBracketSize(tournament.participants.length)} onClick={handleGenerateBracket}>Generate Bracket</Button>
          </RoleGuard>
        )}
        {tournament.bracket.length > 0 && tournament.status === 'DRAFT' && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button onClick={startTournament}>Start Tournament</Button>
          </RoleGuard>
        )}
      </div>

      {championId && (
        <div className="bracket-champion mb-8">
          <span className="bracket-champion-icon">🏆</span>
          <div><span className="bracket-champion-label">Tournament champion</span><strong>{championName}</strong></div>
        </div>
      )}

      {!tournament.bracket.length ? (
        <Card className="text-center py-20 max-w-xl mx-auto">
          {groupTournament ? <>
            <p className="text-accent-grey mb-4">
              {!groupStageComplete
                ? 'Finish all group matches to calculate qualifiers and generate the knockout bracket.'
                : isPowerOfTwoBracketSize(groupQualifierCount)
                  ? `The group stage is complete with ${groupQualifierCount} knockout qualifiers.`
                  : `The group stage has ${groupQualifierCount} qualifiers. Knockout brackets require 2, 4, 8, 16, 32, or 64 players.`}
            </p>
            {groupStageComplete && !isPowerOfTwoBracketSize(groupQualifierCount) && (
              <p className="mb-4 text-sm text-accent-grey">Adjust the Qualify controls in the group standings to make a power-of-two field.</p>
            )}
            <Link to={`/tournament/${tournament.id}/groups`}><Button variant="secondary">Open group stage</Button></Link>
          </> : <>
            <p className="text-accent-grey mb-4">No bracket generated yet.</p>
            <p className="mb-6 text-sm text-accent-grey">{bracketSizeGuidance(tournament.participants.length)}</p>
            {!isPowerOfTwoBracketSize(tournament.participants.length) && (
              <Link className="mb-4 block text-sm text-primary hover:underline" to={`/tournament/${tournament.id}/participants`}>Manage participants</Link>
            )}
            <RoleGuard allowedRoles={['ORGANIZER']}>
              <Button disabled={!isPowerOfTwoBracketSize(tournament.participants.length)} onClick={handleGenerateBracket}>Generate Bracket Now</Button>
            </RoleGuard>
          </>}
        </Card>
      ) : (
        <div className="bracket-round-view">
          <nav className="bracket-round-tabs" role="tablist" aria-label="Bracket rounds">
            {columns.map(([key, matches]) => <button
              key={key}
              type="button"
              role="tab"
              aria-selected={(activeRound?.[0] ?? null) === key}
              className={`bracket-round-tab ${(activeRound?.[0] ?? null) === key ? 'bracket-round-tab-active' : ''}`}
              onClick={() => setActiveRoundKey(key)}
            >
              <span>{bracketLabel(matches[0]?.bracketType)}</span>
              <strong>Round {matches[0]?.round}</strong>
              <small>{matches.length} {matches.length === 1 ? 'match' : 'matches'}</small>
            </button>)}
          </nav>
          {activeRound && <section key={activeRound[0]} className="bracket-round-panel" role="tabpanel">
            <header className="bracket-round-header">
              <span>{bracketLabel(activeRound[1][0]?.bracketType)}</span>
              <h3>Round {activeRound[1][0]?.round}</h3>
              <small>{activeRound[1].length} {activeRound[1].length === 1 ? 'match' : 'matches'}</small>
            </header>
            <div className="bracket-match-list">
            {activeRound[1].map(match => (
                <Card key={match.id} className={`bracket-match ${match.winnerId ? 'bracket-match-won' : ''}`}>
                  {canEditSeeds && match.bracketType === 'UPPER' && match.round === 1 && (
                    <p className="mb-2 text-right text-xs text-accent-grey">{match.manuallyEdited ? 'Manual placement' : 'Opening match'}</p>
                  )}
                  {[1, 2].map(slot => {
                    const participantId = slot === 1 ? match.participant1Id : match.participant2Id;
                    const score = slot === 1
                      ? scoreDrafts[match.id]?.[0] ?? match.score1
                      : scoreDrafts[match.id]?.[1] ?? match.score2;
                    return <div key={slot} className={`bracket-player ${match.winnerId === participantId && participantId ? 'bracket-player-won' : ''}`}>
                      {canEditSeeds && match.bracketType === 'UPPER' && match.round === 1 ? (
                        <select
                          value={participantId ?? ''}
                          onChange={event => updateTournament({ ...tournament, bracket: editOpeningMatch(tournament.bracket, match.id, slot as 1 | 2, event.target.value || null) })}
                          className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-sm"
                          aria-label={`Opening bracket slot ${slot + (match.position * 2)}`}
                        >
                          {entrants.map(id => <option key={id} value={id}>{tournament.participants.find(participant => participant.id === id)?.name}</option>)}
                        </select>
                      ) : (
                        <span className={`truncate ${match.winnerId === participantId && participantId ? 'text-primary font-bold' : 'text-accent-white'}`}>
                          {participantId
                            ? tournament.participants.find(participant => participant.id === participantId)?.name ?? 'Unknown participant'
                            : match.status === 'COMPLETED' && (match.participant1Id || match.participant2Id) ? 'Bye' : 'TBD'}
                        </span>
                      )}
                      <ScoreStepper
                        value={score}
                        onChange={value => setScoreDrafts(current => ({
                          ...current,
                          [match.id]: slot === 1
                            ? [value, current[match.id]?.[1] ?? match.score2]
                            : [current[match.id]?.[0] ?? match.score1, value]
                        }))}
                        disabled={userRole !== 'ORGANIZER' || !match.participant1Id || !match.participant2Id || tournament.status === 'DRAFT'}
                      />
                    </div>;
                  })}
                  <div className="bracket-match-footer">
                    <span className={`bracket-status ${match.status === 'COMPLETED' ? 'bracket-status-complete' : ''}`}>{scoreDrafts[match.id] ? 'IN PROGRESS' : match.status.replace('_', ' ')}</span>
                    {match.manualWinnerId && <span className="bracket-manual-tag">Manual winner</span>}
                    {userRole === 'ORGANIZER' && tournament.status !== 'DRAFT' && match.participant1Id && match.participant2Id && (
                      <Button
                        variant="secondary"
                        className="py-1 text-xs"
                        disabled={(scoreDrafts[match.id]?.[0] ?? match.score1) === (scoreDrafts[match.id]?.[1] ?? match.score2)}
                        onClick={() => {
                          const [score1, score2] = scoreDrafts[match.id] ?? [match.score1, match.score2];
                          handleUpdateScore(match.id, score1, score2);
                          setScoreDrafts(current => { const next = { ...current }; delete next[match.id]; return next; });
                        }}
                      >Save result</Button>
                    )}
                  </div>
                  {userRole === 'ORGANIZER' && match.status === 'COMPLETED' && match.participant1Id && match.participant2Id && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-accent-grey">
                      Override winner
                      <select
                        value={match.manualWinnerId ?? ''}
                        onChange={event => handleWinnerOverride(match.id, event.target.value || null)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-accent-white"
                      >
                        <option value="">Use score result</option>
                        <option value={match.participant1Id}>{tournament.participants.find(participant => participant.id === match.participant1Id)?.name}</option>
                        <option value={match.participant2Id}>{tournament.participants.find(participant => participant.id === match.participant2Id)?.name}</option>
                      </select>
                    </label>
                  )}
                </Card>
            ))}
            </div>
          </section>}
        </div>
      )}
    </div>
  );
};
