import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Button, Card, Input } from '../components/ui/Common';
import { RoleGuard } from '../components/RoleGuard';
import { useTournamentStore } from '../store/useTournamentStore';

export const ParticipantManagement = () => {
  const { id } = useParams();
  const { tournaments, updateTournament, userRole } = useTournamentStore();
  const tournament = tournaments.find(item => item.id === id);
  const [search, setSearch] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const participants = useMemo(() => [...(tournament?.participants ?? [])]
    .filter(participant => participant.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [tournament, search]);

  if (!tournament) return <div className="p-10 text-center text-accent-grey">Tournament not found.</div>;

  const resetStructure = (participantList: typeof tournament.participants, status = tournament.status) => ({
    ...tournament,
    participants: participantList,
    groups: [],
    groupMatches: [],
    bracket: [],
    qualifiedParticipantIds: [],
    qualificationOverrides: undefined,
    status
  });

  const addParticipants = () => {
    const names = bulkText.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    if (!names.length) return alert('Enter at least one participant name.');
    const allNames = [...tournament.participants.map(participant => participant.name), ...names].map(name => name.toLocaleLowerCase());
    const duplicates = [...new Set(allNames.filter((name, index) => allNames.indexOf(name) !== index))];
    if (duplicates.length) return alert(`Duplicate participant names: ${duplicates.join(', ')}`);
    const hasStructure = tournament.groups.length > 0 || (tournament.groupMatches?.length ?? 0) > 0 || tournament.bracket.length > 0;
    if ((tournament.status !== 'DRAFT' || hasStructure) && !window.confirm('Adding participants requires clearing the current groups, bracket, and results. Continue?')) return;
    const added = names.map(name => ({ id: uuidv4(), name, points: 0, wins: 0, losses: 0 }));
    updateTournament(resetStructure([...tournament.participants, ...added], 'DRAFT'));
    setBulkText('');
  };

  const saveName = (participantId: string) => {
    const name = (nameDrafts[participantId] ?? tournament.participants.find(participant => participant.id === participantId)?.name ?? '').trim();
    if (!name) return alert('Participant name cannot be empty.');
    if (tournament.participants.some(participant => participant.id !== participantId && participant.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return alert('A participant with that name already exists.');
    }
    updateTournament({
      ...tournament,
      participants: tournament.participants.map(participant => participant.id === participantId ? { ...participant, name } : participant)
    });
    setNameDrafts(current => { const next = { ...current }; delete next[participantId]; return next; });
  };

  const removeParticipant = (participantId: string) => {
    const participant = tournament.participants.find(item => item.id === participantId);
    if (!participant) return;
    const hasStructure = tournament.groups.length > 0 || (tournament.groupMatches?.length ?? 0) > 0 || tournament.bracket.length > 0;
    const message = hasStructure || tournament.status !== 'DRAFT'
      ? `Remove ${participant.name}? This will clear all groups, brackets, and existing results and return the tournament to draft.`
      : `Remove ${participant.name}?`;
    if (!window.confirm(message)) return;
    const remaining = tournament.participants.filter(item => item.id !== participantId);
    updateTournament(resetStructure(remaining, 'DRAFT'));
  };

  const assignment = (participantId: string) => {
    const group = tournament.groups.find(item => item.participantIds.includes(participantId));
    const matches = tournament.bracket.filter(match => match.participant1Id === participantId || match.participant2Id === participantId);
    return group?.name ?? (matches.length ? `${matches.length} bracket match${matches.length === 1 ? '' : 'es'}` : 'Unassigned');
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to={`/tournament/${tournament.id}`} className="text-sm text-accent-grey hover:text-primary">← Tournament</Link>
          <h1 className="mt-2 text-3xl font-bold text-primary">Participants</h1>
          <p className="text-accent-grey">{tournament.participants.length} total</p>
        </div>
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search participants" />
      </div>

      <RoleGuard allowedRoles={['ORGANIZER']}>
        <Card className="space-y-3">
          <h2 className="font-bold">Add participants</h2>
          <textarea
            value={bulkText}
            onChange={event => setBulkText(event.target.value)}
            className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-accent-white"
            placeholder="One participant per line"
          />
          <p className="text-xs text-accent-grey">Preview: {bulkText.split(/\r?\n/).map(name => name.trim()).filter(Boolean).length} non-empty names</p>
          <Button onClick={addParticipants} className="self-start">Add participants</Button>
        </Card>
      </RoleGuard>

      <Card className="space-y-3">
        {participants.map(participant => (
          <div key={participant.id} className="grid grid-cols-1 md:grid-cols-[1fr_12rem_auto] gap-3 items-center border-b border-zinc-800 pb-3 last:border-0">
            {userRole === 'ORGANIZER' ? (
              <Input
                value={nameDrafts[participant.id] ?? participant.name}
                onChange={event => setNameDrafts(current => ({ ...current, [participant.id]: event.target.value }))}
                onBlur={() => nameDrafts[participant.id] !== undefined && saveName(participant.id)}
                onKeyDown={event => { if (event.key === 'Enter') saveName(participant.id); }}
                aria-label={`Name for ${participant.name}`}
              />
            ) : <span className="font-medium">{participant.name}</span>}
            <span className="text-sm text-accent-grey">{assignment(participant.id)}</span>
            {userRole === 'ORGANIZER' && <Button variant="danger" className="py-1" onClick={() => removeParticipant(participant.id)}>Remove</Button>}
          </div>
        ))}
        {!participants.length && <p className="py-8 text-center text-accent-grey">No participants match that search.</p>}
      </Card>
    </div>
  );
};
