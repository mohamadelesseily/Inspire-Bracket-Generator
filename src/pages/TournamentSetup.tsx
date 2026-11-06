import React from 'react';
import { Button, Card, Input } from '../components/ui/Common';
import { useTournamentStore } from '../store/useTournamentStore';
import type { TournamentFormat, Tournament } from '../types/tournament';
import { v4 as uuidv4 } from 'uuid';
import { getBestThirdPlaceQualifierCount } from '../logic/qualification';

const shuffle = <T,>(values: T[]) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

export const TournamentSetup = () => {
  const { addTournament, userRole } = useTournamentStore();
  const [name, setName] = React.useState('');
  const [format, setFormat] = React.useState<TournamentFormat>('SINGLE_ELIM');
  const [participantsText, setParticipantsText] = React.useState('');
  const [groupSize, setGroupSize] = React.useState(4);
  const [matchesPerParticipant, setMatchesPerParticipant] = React.useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = React.useState(2);
  const [bracketSeeding, setBracketSeeding] = React.useState<'RANDOM' | 'SEEDED'>('SEEDED');
  const [tieBreakers, setTieBreakers] = React.useState(['goalDiff', 'goalsScored', 'headToHead']);
  const participantNames = participantsText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const groupCount = Math.ceil(participantNames.length / groupSize);
  const bestThirdPlaces = getBestThirdPlaceQualifierCount(groupCount, qualifiersPerGroup);
  const duplicateNames = [...new Set(participantNames.filter((value, index) =>
    participantNames.findIndex(name => name.toLocaleLowerCase() === value.toLocaleLowerCase()) !== index
  ))];

  if (userRole !== 'ORGANIZER') return <div className="p-10 text-center text-accent-grey">Organizer access required to create tournaments.</div>;

  const handleCreate = () => {
    if (!name.trim()) return alert('Please enter a tournament name');

    const participantsList = participantsText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p !== '')
      .map(name => ({
        id: uuidv4(),
        name,
        points: 0,
        wins: 0,
        losses: 0
      }));

    if (participantsList.length < 2) return alert('Add at least two participants.');
    if (duplicateNames.length) return alert(`Remove duplicate participant names: ${duplicateNames.join(', ')}`);
    if (format === 'GROUP_SINGLE') {
      if (!Number.isInteger(groupSize) || !Number.isInteger(matchesPerParticipant) || !Number.isInteger(qualifiersPerGroup) ||
        groupSize < 2 || matchesPerParticipant < 1 || qualifiersPerGroup < 1 || qualifiersPerGroup > groupSize) {
        return alert('Check the group size, matches per participant, and qualifiers per group.');
      }
      if (groupCount * 2 > participantsList.length) return alert('These participants cannot be divided into groups of at least two with the selected group size.');
      if (qualifiersPerGroup === 2 && bestThirdPlaces === 0 && !Number.isInteger(Math.log2(groupCount * qualifiersPerGroup))) {
        return alert('This group setup cannot reach a power-of-two knockout by adding the available third-place teams. Change the group size or qualifiers per group.');
      }
      const qualificationCount = groupCount * qualifiersPerGroup + bestThirdPlaces;
      if (qualificationCount < 2 || qualificationCount > participantsList.length) {
        return alert('The qualification rules must produce between 2 and the total participant count.');
      }
    }

    const newTournament: Tournament = {
      id: uuidv4(),
      name: name.trim(),
      format,
      status: 'DRAFT',
      participants: participantsList,
      groups: [],
      bracket: [],
      config: {
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
        tieBreakers,
        groupSize,
        matchesPerParticipant,
        qualifiersPerGroup,
        bestThirdPlaceQualifiers: bestThirdPlaces,
        bracketSeeding,
        randomDrawOrder: shuffle(participantsList).map(participant => participant.id),
      }
    };

    addTournament(newTournament);
    alert('Tournament created successfully!');
    setName('');
    setParticipantsText('');
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold text-primary mb-8 text-center">Create Tournament</h1>

      <Card className="space-y-6">
        <div className="flex flex-col space-y-2">
          <label className="text-accent-grey text-sm">Tournament Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Winter Championship 2026"
          />
        </div>

        <div className="space-y-2">
          <p className="text-accent-grey text-sm">Group tie-breakers (highest priority first)</p>
          {[
            ['goalDiff', 'Goal difference'],
            ['goalsScored', 'Goals scored'],
            ['headToHead', 'Head-to-head'],
            ['wins', 'Wins'],
            ['organizerDecision', 'Organizer order'],
            ['randomDraw', 'Random draw']
          ].map(([key, label]) => {
            const index = tieBreakers.indexOf(key);
            return <div key={key} className="flex items-center gap-3 text-sm text-accent-white">
              <input
                type="checkbox"
                checked={index >= 0}
                onChange={() => setTieBreakers(current => index >= 0 ? current.filter(item => item !== key) : [...current, key])}
              />
              <span className="flex-1">{label}</span>
              {index >= 0 && <>
                <span className="text-accent-grey">{index + 1}</span>
                <button type="button" disabled={index === 0} onClick={() => setTieBreakers(current => {
                  const next = [...current];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  return next;
                })} aria-label={`Move ${label} up`}>↑</button>
                <button type="button" disabled={index === tieBreakers.length - 1} onClick={() => setTieBreakers(current => {
                  const next = [...current];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  return next;
                })} aria-label={`Move ${label} down`}>↓</button>
              </>}
            </div>;
          })}
        </div>

        {format === 'GROUP_SINGLE' && (
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm text-accent-grey">Participants per group
              <Input type="number" min={2} max={64} value={groupSize} onChange={event => setGroupSize(Number(event.target.value))} />
            </label>
            <label className="flex flex-col gap-2 text-sm text-accent-grey">Matches per participant
              <Input type="number" min={1} max={63} value={matchesPerParticipant} onChange={event => setMatchesPerParticipant(Number(event.target.value))} />
            </label>
            <label className="flex flex-col gap-2 text-sm text-accent-grey">Qualifiers per group
              <Input type="number" min={1} max={64} value={qualifiersPerGroup} onChange={event => setQualifiersPerGroup(Number(event.target.value))} />
            </label>
            <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-accent-grey">
              Best third places are calculated automatically to complete a power-of-two knockout.
              <span className="ml-1 font-semibold text-primary">{bestThirdPlaces} third-place {bestThirdPlaces === 1 ? 'team' : 'teams'} will qualify.</span>
            </div>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <label className="text-accent-grey text-sm">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as TournamentFormat)}
            className="bg-zinc-950 border border-zinc-800 text-accent-white px-4 py-2 rounded-md focus:outline-none focus:border-primary transition-colors"
          >
            <option value="SINGLE_ELIM">Single Elimination</option>
            <option value="DOUBLE_ELIM">Double Elimination</option>
            <option value="GROUP_SINGLE">Group Stage + Single Elimination</option>
          </select>
        </div>

        <label className="flex flex-col gap-2 text-sm text-accent-grey">Bracket seeding
          <select
            value={bracketSeeding}
            onChange={event => setBracketSeeding(event.target.value as 'RANDOM' | 'SEEDED')}
            className="bg-zinc-950 border border-zinc-800 text-accent-white px-4 py-2 rounded-md"
          >
            <option value="SEEDED">Participant order / group position</option>
            <option value="RANDOM">Randomize before bracket generation</option>
          </select>
        </label>

        <div className="flex flex-col space-y-2">
          <label className="text-accent-grey text-sm">Participants (One per line)</label>
          <textarea
            value={participantsText}
            onChange={(e) => setParticipantsText(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-accent-white px-4 py-2 rounded-md h-40 focus:outline-none focus:border-primary transition-colors"
            placeholder="Player 1&#10;Player 2&#10;Team A&#10;Team B"
          />
          <p className="text-xs text-accent-grey">{participantNames.length} participants · blank lines are ignored</p>
          {duplicateNames.length > 0 && <p className="text-sm text-red-400">Duplicate names: {duplicateNames.join(', ')}</p>}
          {participantNames.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded border border-zinc-800 p-3 text-sm text-accent-grey">
              {participantNames.map((participantName, index) => <div key={`${participantName}-${index}`}>{index + 1}. {participantName}</div>)}
            </div>
          )}
        </div>

        <Button onClick={handleCreate} className="w-full py-3 text-lg">
          Create Tournament
        </Button>
      </Card>
    </div>
  );
};
