import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Card, Input } from '../components/ui/Common';
import { RoleGuard } from '../components/RoleGuard';
import { useTournamentStore } from '../store/useTournamentStore';
import type { Group } from '../types/tournament';

export const GroupEditor = () => {
  const { id } = useParams();
  const { tournaments, updateTournament, userRole } = useTournamentStore();
  const tournament = tournaments.find(item => item.id === id);

  if (!tournament) return <div className="p-10 text-center text-accent-grey">Tournament not found.</div>;
  if (tournament.format !== 'GROUP_SINGLE') return <div className="p-10 text-center text-accent-grey">This tournament does not have groups.</div>;

  const saveGroups = (groups: Group[]) => updateTournament({
    ...tournament,
    groups,
    groupMatches: [],
    bracket: [],
    qualifiedParticipantIds: [],
    qualificationOverrides: undefined,
    status: 'DRAFT'
  });

  const moveParticipant = (participantId: string, targetGroupId: string) => {
    const currentGroup = tournament.groups.find(group => group.participantIds.includes(participantId));
    if (currentGroup?.id === targetGroupId) return;
    if ((tournament.groupMatches?.length ?? 0) > 0 || tournament.bracket.length > 0) {
      if (!window.confirm('Changing group members clears the group schedule, results, and knockout bracket. Continue?')) return;
    }
    saveGroups(tournament.groups.map(group => ({
      ...group,
      participantIds: group.id === targetGroupId
        ? [...group.participantIds.filter(id => id !== participantId), participantId]
        : group.participantIds.filter(id => id !== participantId)
    })));
  };

  const renameGroup = (groupId: string, name: string) => updateTournament({
    ...tournament,
    groups: tournament.groups.map(group => group.id === groupId ? { ...group, name } : group)
  });

  const addGroup = () => {
    const nextLetter = String.fromCharCode(65 + tournament.groups.length);
    saveGroups([...tournament.groups, {
      id: `group-${uuidv4()}`,
      name: `Group ${nextLetter}`,
      participantIds: [],
      standings: []
    }]);
  };

  const removeEmptyGroup = (groupId: string) => {
    const group = tournament.groups.find(item => item.id === groupId);
    if (!group || group.participantIds.length > 0) return;
    saveGroups(tournament.groups.filter(item => item.id !== groupId));
  };

  const assignedIds = new Set(tournament.groups.flatMap(group => group.participantIds));
  const unassigned = tournament.participants.filter(participant => !assignedIds.has(participant.id));

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to={`/tournament/${tournament.id}/groups`}
            className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-accent-white transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to group stage
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-primary">Edit groups</h1>
          <p className="mt-1 text-accent-grey">Move participants between groups. Changes to members clear existing matches and results.</p>
        </div>
        <RoleGuard allowedRoles={['ORGANIZER']}>
          <Button onClick={addGroup}>Add group</Button>
        </RoleGuard>
      </div>

      {tournament.groups.length === 0 ? (
        <Card className="text-center space-y-3">
          <p className="text-accent-grey">No groups yet. Add a group to start assigning participants.</p>
          <RoleGuard allowedRoles={['ORGANIZER']}><Button onClick={addGroup}>Add first group</Button></RoleGuard>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {tournament.groups.map(group => (
            <Card key={group.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  aria-label="Group name"
                  value={group.name}
                  disabled={userRole !== 'ORGANIZER' || tournament.status !== 'DRAFT'}
                  onChange={event => renameGroup(group.id, event.target.value)}
                  className="font-bold"
                />
                <span className="shrink-0 text-xs text-accent-grey">{group.participantIds.length} players</span>
              </div>
              <div className="space-y-2">
                {group.participantIds.map(participantId => {
                  const participant = tournament.participants.find(item => item.id === participantId);
                  if (!participant) return null;
                  return <div key={participantId} className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2 items-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                    <span className="truncate text-sm" title={participant.name}>{participant.name}</span>
                    <select
                      aria-label={`Move ${participant.name} to group`}
                      value={group.id}
                      disabled={userRole !== 'ORGANIZER' || tournament.status !== 'DRAFT'}
                      onChange={event => moveParticipant(participantId, event.target.value)}
                      className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-accent-white"
                    >
                      {tournament.groups.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </div>;
                })}
                {group.participantIds.length === 0 && <p className="text-sm text-accent-grey">No members assigned.</p>}
              </div>
              {group.participantIds.length === 0 && userRole === 'ORGANIZER' && tournament.status === 'DRAFT' && tournament.groups.length > 1 &&
                <button type="button" onClick={() => removeEmptyGroup(group.id)} className="text-xs text-red-400 hover:text-red-300">Remove empty group</button>}
            </Card>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-bold text-accent-white">Unassigned participants</h2>
            <p className="text-sm text-accent-grey">Choose a group for each participant.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {unassigned.map(participant => <div key={participant.id} className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2 items-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
              <span className="truncate text-sm" title={participant.name}>{participant.name}</span>
              <select
                aria-label={`Assign ${participant.name} to group`}
                value=""
                disabled={userRole !== 'ORGANIZER' || tournament.status !== 'DRAFT' || !tournament.groups.length}
                onChange={event => moveParticipant(participant.id, event.target.value)}
                className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-accent-white"
              >
                <option value="" disabled>Choose group</option>
                {tournament.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>)}
          </div>
        </Card>
      )}

      {userRole === 'ORGANIZER' && tournament.status !== 'DRAFT' && <p className="text-sm text-accent-grey">Group editing is available while the tournament is in draft.</p>}
    </div>
  );
};
