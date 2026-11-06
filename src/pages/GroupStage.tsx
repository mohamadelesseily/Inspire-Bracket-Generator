import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournamentStore } from '../store/useTournamentStore';
import { groupLogic } from '../logic/groupGenerator';
import { Button, Card } from '../components/ui/Common';
import { ScoreStepper } from '../components/ui/ScoreStepper';
import { RoleGuard } from '../components/RoleGuard';
import type { Match } from '../types/tournament';
import { getBestThirdPlaceQualifierCount, getGroupStandings, groupMatchesComplete, qualifyGroupParticipants, rankThirdPlaceParticipants } from '../logic/qualification';
import { bracketLogic, bracketSizeGuidance, isPowerOfTwoBracketSize } from '../logic/bracketGenerator';
import { v4 as uuidv4 } from 'uuid';

const buildGroupSchedule = (groups: ReturnType<typeof groupLogic.generateGroups>, matchesPerParticipant: number): Match[] => {
  const matches: Match[] = [];
  for (const group of groups) {
    const groupMatches = groupLogic.generateGroupMatches(group.id, group.participantIds, matchesPerParticipant);
    const counts = new Map(group.participantIds.map(id => [id, 0]));
    groupMatches.forEach(match => {
      if (match.participant1Id) counts.set(match.participant1Id, (counts.get(match.participant1Id) ?? 0) + 1);
      if (match.participant2Id) counts.set(match.participant2Id, (counts.get(match.participant2Id) ?? 0) + 1);
    });
    if ([...counts.values()].some(count => count !== matchesPerParticipant)) {
      throw new Error(`${group.name} cannot schedule exactly ${matchesPerParticipant} distinct opponents per participant.`);
    }
    matches.push(...groupMatches);
  }
  return matches;
};

const shuffle = <T,>(values: T[]) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

const thirdPlaceReason = (
  entry: ReturnType<typeof rankThirdPlaceParticipants>[number],
  ranking: ReturnType<typeof rankThirdPlaceParticipants>,
  qualifierCount: number,
  qualifiersPerGroup: number,
  tieBreakers: string[],
  standingOrder: string[],
  randomDrawOrder: string[]
) => {
  if (qualifiersPerGroup > 2) return `Qualifies directly: the top ${qualifiersPerGroup} in each group advance.`;
  if (qualifierCount === 0) return 'No best third-place spots are needed for the knockout size.';
  const cutoff = ranking[qualifierCount - 1];
  if (entry.rank === qualifierCount) return `Last qualifying place: rank ${qualifierCount} of ${ranking.length}.`;
  if (!cutoff) return `Rank ${entry.rank} of ${ranking.length}; no third-place slots are available.`;

  const criteria: { key: string; label: string; value: (standing: typeof entry.standing, participantId: string) => number; higherIsBetter?: boolean; display: (value: number) => string }[] = [
    { key: 'points', label: 'points', value: standing => standing.points, display: value => `${value} pts` },
    { key: 'goalDiff', label: 'goal difference', value: standing => standing.goalDiff, display: value => `${value > 0 ? '+' : ''}${value} GD` },
    { key: 'goalsScored', label: 'goals scored', value: standing => standing.goalsScored ?? 0, display: value => `${value} goals` },
    { key: 'wins', label: 'wins', value: standing => standing.wins, display: value => `${value} wins` },
    { key: 'organizerDecision', label: 'organizer tie order', value: (_, id) => standingOrder.indexOf(id) < 0 ? Number.MAX_SAFE_INTEGER : standingOrder.indexOf(id), higherIsBetter: false, display: value => value === Number.MAX_SAFE_INTEGER ? 'unranked' : `order ${value + 1}` },
    { key: 'randomDraw', label: 'random draw', value: (_, id) => randomDrawOrder.indexOf(id) < 0 ? Number.MAX_SAFE_INTEGER : randomDrawOrder.indexOf(id), higherIsBetter: false, display: value => value === Number.MAX_SAFE_INTEGER ? 'unranked' : `draw ${value + 1}` }
  ];
  const compareBy = (key: string) => criteria.find(criterion => criterion.key === key);
  const comparisonOrder = ['points', ...tieBreakers.filter(rule => rule !== 'headToHead')];
  for (const key of comparisonOrder) {
    const criterion = compareBy(key);
    if (!criterion) continue;
    const entryValue = criterion.value(entry.standing, entry.standing.participantId);
    const cutoffValue = criterion.value(cutoff.standing, cutoff.standing.participantId);
    if (entryValue === cutoffValue) continue;
    const ahead = criterion.higherIsBetter === false ? entryValue < cutoffValue : entryValue > cutoffValue;
    const location = ahead ? 'Ranks ahead of' : 'Falls behind';
    return `${location} the cutoff on ${criterion.label}: ${criterion.display(entryValue)} vs ${criterion.display(cutoffValue)} (cutoff rank ${qualifierCount}).`;
  }
  return entry.rank < qualifierCount
    ? `Qualifies at rank ${entry.rank}; the tie-breakers are level with the cutoff.`
    : `Outside the top ${qualifierCount}; the configured tie-breakers place it below the cutoff.`;
};

export const GroupStage = () => {
  const { id } = useParams();
  const { tournaments, updateTournament, userRole } = useTournamentStore();
  const tournament = tournaments.find(t => t.id === id);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, [number, number]>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, Match[]>>({});

  if (!tournament) return <div className="text-center py-20 text-accent-grey">Tournament not found.</div>;
  if (tournament.format !== 'GROUP_SINGLE') return <div className="p-10 text-center text-accent-grey">This tournament does not have a group stage. <Link to={`/tournament/${tournament.id}/bracket`} className="text-primary">Open bracket</Link></div>;

  const handleGenerateGroups = () => {
    if (tournament.groups.length && !window.confirm('Regenerating groups replaces all current group assignments and results. Continue?')) return;
    if (tournament.participants.length < 2) return alert('Add at least two participants before generating groups.');
    const groupSize = tournament.config.groupSize ?? 4;
    const qualifiers = tournament.config.qualifiersPerGroup ?? 2;
    if (groupSize < 2 || qualifiers < 1 || qualifiers > groupSize) return alert('Check the group size and qualifiers per group.');
    const groups = groupLogic.generateGroups(tournament.participants, groupSize);
    if (groups.some(group => group.participantIds.length < 2)) return alert('These participants cannot be divided into groups of at least two. Increase the group size or change the participant count.');

    let allMatches: Match[];
    try {
      allMatches = buildGroupSchedule(groups, tournament.config.matchesPerParticipant ?? 2);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create a valid group schedule.');
      return;
    }

    updateTournament({
      ...tournament,
      groups,
      groupMatches: allMatches,
      bracket: [],
      qualifiedParticipantIds: [],
      qualificationOverrides: undefined,
      status: 'DRAFT'
    });
    setScheduleDrafts({});
  };

  const handleGenerateMatches = () => {
    if (tournament.status !== 'DRAFT') return alert('Group matches can only be regenerated before the tournament starts.');
    if ((tournament.groupMatches?.length ?? 0) && !window.confirm('Regenerating matches deletes the current group schedule and results. Continue?')) return;
    try {
      const groupMatches = buildGroupSchedule(tournament.groups, tournament.config.matchesPerParticipant ?? 2);
      updateTournament({ ...tournament, groupMatches, bracket: [], qualifiedParticipantIds: [], status: 'DRAFT' });
      setScheduleDrafts({});
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create a valid group schedule.');
    }
  };

  const handleUpdateScore = (matchId: string, p1Score: number, p2Score: number) => {
    if (tournament.bracket.length && !window.confirm('Changing a group result will clear the current knockout bracket and results. Continue?')) return;
    const updatedGroupMatches = (tournament.groupMatches ?? []).map(m => {
      if (m.id === matchId) {
        const winnerId = p1Score > p2Score ? m.participant1Id : p2Score > p1Score ? m.participant2Id : null;
        return { ...m, score1: p1Score, score2: p2Score, winnerId, status: 'COMPLETED' as const };
      }
      return m;
    });

    const updated = { ...tournament, groupMatches: updatedGroupMatches };
    updateTournament({ ...updated, bracket: [], qualifiedParticipantIds: [], status: 'LIVE' });
  };

  const handleGenerateKnockout = () => {
    if (tournament.bracket.length && !window.confirm('Regenerating the knockout bracket will delete its matches and results. Continue?')) return;
    const qualifiedParticipantIds = qualifyGroupParticipants(tournament);
    if (qualifiedParticipantIds.length < 2) return alert('The qualification settings must produce at least two knockout participants.');
    if (!isPowerOfTwoBracketSize(qualifiedParticipantIds.length)) return alert(bracketSizeGuidance(qualifiedParticipantIds.length));
    const qualified = qualifiedParticipantIds.map(participantId => tournament.participants.find(participant => participant.id === participantId)!).filter(Boolean);
    const entrants = tournament.config.bracketSeeding === 'RANDOM'
      ? shuffle(qualified)
      : qualified;
    const bracket = bracketLogic.generateSingleElimination(entrants, tournament.id);
    updateTournament({ ...tournament, qualifiedParticipantIds, bracket, status: 'DRAFT' });
  };

  const handleMoveParticipant = (participantId: string, fromGroupId: string, toGroupId: string) => {
    if (fromGroupId === toGroupId) return;
    const fromGroup = tournament.groups.find(group => group.id === fromGroupId);
    const toGroup = tournament.groups.find(group => group.id === toGroupId);
    if (!fromGroup || !toGroup) return;
    if (fromGroup.participantIds.length <= 2) return alert('Each group must keep at least two participants.');
    if (toGroup.participantIds.length >= (tournament.config.groupSize ?? 4)) return alert(`${toGroup.name} has reached its configured capacity.`);
    if ((tournament.groupMatches?.length ?? 0) > 0 && !window.confirm('Moving a participant will clear the current group schedule, results, and knockout bracket. Continue?')) return;
    const groups = tournament.groups.map(group => group.id === fromGroupId
      ? { ...group, participantIds: group.participantIds.filter(id => id !== participantId) }
      : group.id === toGroupId
        ? { ...group, participantIds: [...group.participantIds, participantId] }
        : group);
    updateTournament({ ...tournament, groups, groupMatches: [], bracket: [], qualifiedParticipantIds: [], status: 'DRAFT' });
    setScheduleDrafts({});
  };

  const moveOrganizerOrder = (participantId: string, groupId: string, direction: -1 | 1) => {
    const group = tournament.groups.find(item => item.id === groupId);
    if (!group) return;
    const rows = getGroupStandings(group, tournament.participants, tournament.groupMatches ?? [], tournament);
    const currentIndex = rows.findIndex(row => row.participantId === participantId);
    const target = rows[currentIndex + direction];
    if (!target) return;
    const groupIds = new Set(group.participantIds);
    const order = [...(tournament.config.standingOrder ?? tournament.participants.map(participant => participant.id))];
    const currentOrderIndex = order.indexOf(participantId);
    const targetOrderIndex = order.indexOf(target.participantId);
    if (currentOrderIndex >= 0 && targetOrderIndex >= 0) {
      [order[currentOrderIndex], order[targetOrderIndex]] = [order[targetOrderIndex], order[currentOrderIndex]];
    } else {
      const scoped = order.filter(id => groupIds.has(id));
      const from = scoped.indexOf(participantId);
      const to = scoped.indexOf(target.participantId);
      if (from >= 0 && to >= 0) [scoped[from], scoped[to]] = [scoped[to], scoped[from]];
      else scoped.splice(Math.max(0, from), 0, participantId);
      const others = order.filter(id => !groupIds.has(id));
      order.splice(0, order.length, ...others, ...scoped);
    }
    updateTournament({ ...tournament, config: { ...tournament.config, standingOrder: order } });
  };

  const selectedGroupId = tournament.groups.some(group => group.id === activeGroupId) ? activeGroupId : tournament.groups[0]?.id ?? null;
  const selectedGroup = tournament.groups.find(group => group.id === selectedGroupId);
  const activeMatches = selectedGroupId
    ? scheduleDrafts[selectedGroupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${selectedGroupId}-`))
    : [];
  const thirdPlaceRanking = rankThirdPlaceParticipants(tournament);
  const bestThirdCount = getBestThirdPlaceQualifierCount(tournament.groups.length, tournament.config.qualifiersPerGroup ?? 2);

  const updateFixtureDraft = (groupId: string, matchId: string, slot: 1 | 2, participantId: string) => {
    setScheduleDrafts(current => {
      const matches = current[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`));
      return { ...current, [groupId]: matches.map(match => match.id !== matchId ? match : {
        ...match,
        participant1Id: slot === 1 ? participantId : match.participant1Id,
        participant2Id: slot === 2 ? participantId : match.participant2Id,
        manuallyEdited: true
      }) };
    });
  };

  const addFixtureDraft = (groupId: string) => {
    const group = tournament.groups.find(item => item.id === groupId);
    if (!group || group.participantIds.length < 2) return;
    const matches = scheduleDrafts[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`));
    const newMatch: Match = {
      id: `match-${groupId}-manual-${uuidv4()}`,
      round: 1,
      position: matches.length,
      participant1Id: group.participantIds[0],
      participant2Id: group.participantIds[1],
      score1: 0,
      score2: 0,
      winnerId: null,
      status: 'SCHEDULED',
      nextMatchId: null,
      manuallyEdited: true
    };
    setScheduleDrafts(current => {
      const existing = current[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`));
      return { ...current, [groupId]: [...existing, newMatch] };
    });
  };

  const removeFixtureDraft = (groupId: string, matchId: string) => {
    const matches = scheduleDrafts[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`));
    setScheduleDrafts(current => ({ ...current, [groupId]: matches.filter(match => match.id !== matchId).map((match, position) => ({ ...match, position })) }));
  };

  const saveGroupSchedule = (groupId: string) => {
    const group = tournament.groups.find(item => item.id === groupId);
    if (!group) return;
    const matches = scheduleDrafts[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`));
    if (matches.some(match => !match.participant1Id || !match.participant2Id || match.participant1Id === match.participant2Id ||
      !group.participantIds.includes(match.participant1Id) || !group.participantIds.includes(match.participant2Id))) {
      return alert('Each match must contain two different participants from this group.');
    }
    const pairings = new Set<string>();
    for (const match of matches) {
      const key = [match.participant1Id, match.participant2Id].sort().join(':');
      if (pairings.has(key)) return alert('Duplicate matchups are not allowed in a group.');
      pairings.add(key);
    }
    const counts = new Map(group.participantIds.map(participantId => [participantId, 0]));
    matches.forEach(match => {
      const participant1Id = match.participant1Id!;
      const participant2Id = match.participant2Id!;
      counts.set(participant1Id, counts.get(participant1Id)! + 1);
      counts.set(participant2Id, counts.get(participant2Id)! + 1);
    });
    const required = tournament.config.matchesPerParticipant ?? 2;
    if ([...counts.values()].some(count => count !== required)) return alert(`Every participant must play exactly ${required} matches.`);
    const groupMatches = [...(tournament.groupMatches ?? []).filter(match => !match.id.startsWith(`match-${groupId}-`)), ...matches];
    updateTournament({ ...tournament, groupMatches, bracket: [], qualifiedParticipantIds: [] });
    setScheduleDrafts(current => { const next = { ...current }; delete next[groupId]; return next; });
  };

  const reorderMatch = (groupId: string, matchId: string, direction: -1 | 1) => {
    const matches = [...(scheduleDrafts[groupId] ?? (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${groupId}-`)))].sort((a, b) => a.position - b.position);
    const index = matches.findIndex(match => match.id === matchId);
    const target = matches[index + direction];
    if (index < 0 || !target) return;
    const reordered = matches.map(match => match.id === matchId
      ? { ...match, position: target.position, manuallyEdited: true }
      : match.id === target.id ? { ...match, position: matches[index].position, manuallyEdited: true } : match);
    setScheduleDrafts(current => ({ ...current, [groupId]: reordered }));
  };

  const currentQualifiers = new Set(qualifyGroupParticipants(tournament));

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <Link to={`/tournament/${tournament.id}/bracket`} className="text-accent-grey hover:text-primary transition-colors">
            ← Bracket
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-primary">{tournament.name}</h1>
            <p className="text-accent-grey">Group Stage Management</p>
          </div>
        </div>
        {tournament.groups.length === 0 && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button onClick={handleGenerateGroups}>Generate Groups & Matches</Button>
          </RoleGuard>
        )}
        {tournament.groups.length > 0 && tournament.status === 'DRAFT' && !groupMatchesComplete(tournament) && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button variant="secondary" onClick={handleGenerateGroups}>Regenerate Groups</Button>
          </RoleGuard>
        )}
        {tournament.groups.length > 0 && !(tournament.groupMatches?.length) && tournament.status === 'DRAFT' && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button onClick={handleGenerateMatches}>Generate Matches</Button>
          </RoleGuard>
        )}
        {tournament.groups.length > 0 && tournament.status === 'DRAFT' && (
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button disabled={!tournament.groupMatches?.length || Object.keys(scheduleDrafts).length > 0} onClick={() => updateTournament({ ...tournament, status: 'LIVE' })}>Start Tournament</Button>
          </RoleGuard>
        )}
      </div>

      {tournament.groups.length === 0 ? (
        <Card className="text-center py-20">
          <p className="text-accent-grey mb-4">No groups generated yet.</p>
          <RoleGuard allowedRoles={['ORGANIZER']}>
            <Button onClick={handleGenerateGroups}>Generate Now</Button>
          </RoleGuard>
        </Card>
      ) : (
        <div className="group-stage-layout">
          <nav className="group-selector" aria-label="Select group" role="tablist">
            {tournament.groups.map(group => {
              const matches = (tournament.groupMatches ?? []).filter(match => match.id.startsWith(`match-${group.id}-`));
              const completed = matches.filter(match => match.status === 'COMPLETED').length;
              return <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={selectedGroupId === group.id}
                className={`group-selector-button ${selectedGroupId === group.id ? 'group-selector-button-active' : ''}`}
                onClick={() => setActiveGroupId(group.id)}
              >
                <span>{group.name}</span>
                <small>{completed}/{matches.length} matches</small>
              </button>;
            })}
          </nav>

          <div className="group-workspace">
          <div className="group-standings-panel">
            {tournament.groups.filter(group => group.id === selectedGroupId).map(group => {
              const standings = getGroupStandings(group, tournament.participants, tournament.groupMatches ?? [], tournament);

              return (
                <Card
                  key={group.id}
                  className="group-standings-card"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-bold text-primary">{group.name}</span>
                    <span className="text-xs text-accent-grey">{group.participantIds.length} Players</span>
                  </div>
                  <div className="group-standings-table-wrap"><table className="w-full text-sm">
                    <thead className="text-left text-accent-grey border-b border-zinc-800">
                      <tr>
                        <th className="pb-2">Pos</th>
                        <th className="pb-2">Player</th>
                        <th className="pb-2 text-right">MP</th>
                        <th className="pb-2 text-right">W-D-L</th>
                        <th className="pb-2 text-right">GD</th>
                        <th className="pb-2 text-right">GS-GA</th>
                        <th className="pb-2 text-right">Pts</th>
                        {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' && <th className="pb-2">Group</th>}
                        {userRole === 'ORGANIZER' && tournament.config.tieBreakers.includes('organizerDecision') && <th className="pb-2 text-right">Tie order</th>}
                      </tr>
                    </thead>
                    <tbody className="text-accent-white">
                      {standings.map((s, idx) => (
                        <tr key={s.participantId} className={`border-b border-zinc-800 last:border-0 ${currentQualifiers.has(s.participantId) ? 'bg-primary/5' : ''}`}>
                          <td className="py-2 text-accent-grey">{idx + 1}</td>
                          <td className="py-2 font-medium">
                            {tournament.participants.find(p => p.id === s.participantId)?.name}
                          </td>
                          <td className="py-2 text-right">{s.matchesPlayed}</td>
                          <td className="py-2 text-right">{s.wins}-{s.draws}-{s.losses}</td>
                          <td className="py-2 text-right">{s.goalDiff}</td>
                          <td className="py-2 text-right">{s.goalsScored}-{s.goalsAgainst}</td>
                          <td className="py-2 text-right font-bold text-primary">{s.points}</td>
                          {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' && <td className="py-2">
                            <select
                              value={group.id}
                              onChange={event => handleMoveParticipant(s.participantId, group.id, event.target.value)}
                              className="bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-xs"
                              aria-label={`Group for ${tournament.participants.find(p => p.id === s.participantId)?.name}`}
                            >
                              {tournament.groups.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                            </select>
                          </td>}
                          {userRole === 'ORGANIZER' && tournament.config.tieBreakers.includes('organizerDecision') && <td className="py-2 text-right">
                            <span className="inline-flex gap-1">
                              <button type="button" onClick={event => { event.stopPropagation(); moveOrganizerOrder(s.participantId, group.id, -1); }} aria-label="Move tie order up">↑</button>
                              <button type="button" onClick={event => { event.stopPropagation(); moveOrganizerOrder(s.participantId, group.id, 1); }} aria-label="Move tie order down">↓</button>
                            </span>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </Card>
              );
            })}
            {groupMatchesComplete(tournament) && thirdPlaceRanking.length > 0 && (
              <Card className="best-third-card">
                <div className="mb-3">
                  <h3 className="font-bold text-accent-white">Best third-place ranking</h3>
                  <p className="text-xs text-accent-grey">
                    Only the top {bestThirdCount} qualify, ranked by points then {tournament.config.tieBreakers.filter(rule => rule !== 'headToHead').join(', ') || 'participant order'}.
                    {' '}Head-to-head is not compared across groups.
                  </p>
                </div>
                <div className="group-standings-table-wrap">
                  <table className="w-full text-sm">
                    <thead className="text-left text-accent-grey border-b border-zinc-800">
                      <tr><th>Rank</th><th>Group</th><th>Third place</th><th className="text-right">Pts</th><th className="text-right">GD</th><th>Qualification reason</th></tr>
                    </thead>
                    <tbody>
                      {thirdPlaceRanking.map(entry => {
                        const participant = tournament.participants.find(item => item.id === entry.standing.participantId);
                        const qualified = currentQualifiers.has(entry.standing.participantId);
                        const reason = thirdPlaceReason(
                          entry,
                          thirdPlaceRanking,
                          bestThirdCount,
                          tournament.config.qualifiersPerGroup ?? 2,
                          tournament.config.tieBreakers,
                          tournament.config.standingOrder ?? [],
                          tournament.config.randomDrawOrder ?? []
                        );
                        return <tr key={entry.standing.participantId} className="border-b border-zinc-800 last:border-0">
                          <td className="py-2">{entry.rank}</td>
                          <td className="py-2">{entry.groupName}</td>
                          <td className="py-2 font-medium">{participant?.name}</td>
                          <td className="py-2 text-right">{entry.standing.points}</td>
                          <td className="py-2 text-right">{entry.standing.goalDiff}</td>
                          <td className={`py-2 text-xs ${qualified ? 'text-primary' : 'text-accent-grey'}`}>{reason}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div className="group-matches-panel">
            <h2 className="text-2xl font-bold text-accent-white mb-4">
              {selectedGroup ? `Matches: ${selectedGroup.name}` : 'Select a group to manage matches'}
            </h2>
            {selectedGroupId ? (
              <>
              {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' && (
                <div className="mb-4 flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => addFixtureDraft(selectedGroupId)}>Add match</Button>
                  <Button onClick={() => saveGroupSchedule(selectedGroupId)}>Save schedule</Button>
                </div>
              )}
              <div className="group-match-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...activeMatches]
                  .sort((a, b) => a.position - b.position)
                  .map((match, matchIndex) => (
                    <Card key={match.id} className="group-match-card flex flex-col space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-accent-grey">Match {match.position + 1}</span>
                        <span className={`text-xs px-2 py-1 rounded ${match.status === 'COMPLETED' ? 'bg-green-900 text-green-300' : 'bg-zinc-800 text-accent-grey'}`}>
                          {match.manuallyEdited ? 'MANUAL · ' : ''}{scoreDrafts[match.id] ? 'IN PROGRESS' : match.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' ? (
                          <select
                            value={match.participant1Id ?? ''}
                            onChange={event => updateFixtureDraft(selectedGroupId!, match.id, 1, event.target.value)}
                            className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-xs"
                            aria-label="First participant"
                          >
                            {selectedGroup?.participantIds.map(participantId => (
                              <option key={participantId} value={participantId}>{tournament.participants.find(p => p.id === participantId)?.name}</option>
                            ))}
                          </select>
                        ) : <div className="flex-1 text-right font-medium">{tournament.participants.find(p => p.id === match.participant1Id)?.name}</div>}
                        <div className="flex gap-2">
                          <ScoreStepper
                            value={scoreDrafts[match.id]?.[0] ?? match.score1}
                            onChange={(value) => setScoreDrafts(current => ({ ...current, [match.id]: [value, current[match.id]?.[1] ?? match.score2] }))}
                            disabled={userRole === 'VIEWER' || (tournament.status === 'DRAFT' && !groupMatchesComplete(tournament))}
                          />
                          <span className="text-zinc-600">-</span>
                          <ScoreStepper
                            value={scoreDrafts[match.id]?.[1] ?? match.score2}
                            onChange={(value) => setScoreDrafts(current => ({ ...current, [match.id]: [current[match.id]?.[0] ?? match.score1, value] }))}
                            disabled={userRole === 'VIEWER' || (tournament.status === 'DRAFT' && !groupMatchesComplete(tournament))}
                          />
                        </div>
                        {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' ? (
                          <select
                            value={match.participant2Id ?? ''}
                            onChange={event => updateFixtureDraft(selectedGroupId!, match.id, 2, event.target.value)}
                            className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-xs"
                            aria-label="Second participant"
                          >
                            {selectedGroup?.participantIds.map(participantId => (
                              <option key={participantId} value={participantId}>{tournament.participants.find(p => p.id === participantId)?.name}</option>
                            ))}
                          </select>
                        ) : <div className="flex-1 text-left font-medium">{tournament.participants.find(p => p.id === match.participant2Id)?.name}</div>}
                      </div>
                      {userRole === 'ORGANIZER' && tournament.status === 'DRAFT' && (
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button variant="secondary" className="py-1" disabled={matchIndex === 0} onClick={() => reorderMatch(selectedGroupId!, match.id, -1)}>↑</Button>
                          <Button variant="secondary" className="py-1" disabled={matchIndex === activeMatches.length - 1} onClick={() => reorderMatch(selectedGroupId!, match.id, 1)}>↓</Button>
                          </div>
                          <Button variant="danger" className="py-1 text-sm" onClick={() => removeFixtureDraft(selectedGroupId!, match.id)}>Remove</Button>
                        </div>
                      )}
                      {userRole === 'ORGANIZER' && tournament.status !== 'DRAFT' && (
                        <Button
                          variant="secondary"
                          className="self-end py-1 text-sm"
                          onClick={() => {
                            const [score1, score2] = scoreDrafts[match.id] ?? [match.score1, match.score2];
                            handleUpdateScore(match.id, score1, score2);
                            setScoreDrafts(current => { const next = { ...current }; delete next[match.id]; return next; });
                          }}
                        >Save result</Button>
                      )}
                    </Card>
                  ))}
              </div>
              {!activeMatches.length && <Card className="text-center text-accent-grey">No matches scheduled. Add fixtures, then save the schedule.</Card>}
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-accent-grey italic">
                Select a group above to manage matches.
              </div>
            )}
            {groupMatchesComplete(tournament) && (
              <Card className="mt-8 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-accent-white">Group stage complete</h3>
                  <p className="text-sm text-accent-grey">
                    {qualifyGroupParticipants(tournament).length} automatic qualifiers ({bestThirdCount} best third-place) · {bracketSizeGuidance(qualifyGroupParticipants(tournament).length)}
                  </p>
                  {!isPowerOfTwoBracketSize(qualifyGroupParticipants(tournament).length) && (
                    <p className="mt-1 text-xs text-primary">Adjust group size or qualifiers per group in tournament setup to produce a power-of-two field.</p>
                  )}
                </div>
                <RoleGuard allowedRoles={['ORGANIZER']}>
                  <Button disabled={Object.keys(scheduleDrafts).length > 0 || !isPowerOfTwoBracketSize(qualifyGroupParticipants(tournament).length)} onClick={handleGenerateKnockout}>{tournament.bracket.length ? 'Regenerate Knockout' : 'Generate Knockout'}</Button>
                </RoleGuard>
              </Card>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
