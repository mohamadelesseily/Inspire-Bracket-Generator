import { v4 as uuidv4 } from 'uuid';
import type { Group, Match, Participant, Tournament } from '../types/tournament';

export const CDP_FIFA_27_NAME = 'CDP FIFA 27';

const GROUP_MEMBERS = [
  ['Youssef Samy', 'Karim Barakat', 'Ahmed Hassan'],
  ['Omar Emad', 'Ismail Zaghloul', 'Ahmed Hany'],
  ['Abdelrahman Osama', 'Mohammad Moustafa', 'Ahmad Moeen Eljbour'],
  ['Mohamed Hani', 'Saleh', 'Youssef Ismail'],
  ['Abdelrahman Alaa', 'Mohamed Eid', 'Youssef Hossam'],
  ['Omar Dabour', 'Kareem Sameh', 'Mohamed El Mohen'],
  ['Omar Soliman', 'Omar Mohamed', 'Abdulaziz Mahmud'],
  ['Omar Fathy', 'Moaz Ahmed Sabbah', 'Mohamed Sayed'],
  ['Eyad Yasser', 'Youssef Mohamed Adel', 'Mohamed Youssef*'],
  ['Kareem Ehab', 'Hazem Zidane', 'AbdelRahman Yassin'],
  ['Hatem Ahmed Elsayed Ali Mohamed Youssef Elabd', 'Osama Ragaei', 'Youssef Mohamed Fawzy'],
  ['Youssef Tamer', 'Omar Tamer', 'Yassin Badrr'],
  ['Kirollos Awny', 'John Fady', 'Omar Shaarawy'],
  ['Omar Zaher', 'Marwan Walid', 'Yehia Tamer'],
  ['Karim Mohamed Saad', 'Seif', 'Youssef Mashaly'],
  ['Malek Khaled', 'Mark Peter', 'Omar Abdelghany']
];

export const createCDPFifa27Schedule = (groups: Group[]): Match[] => {
  const fixturePairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  const roundLabels = ['Player 1 vs Player 2', 'Player 1 vs Player 3', 'Player 2 vs Player 3'];
  const startMinutesByRound = [17 * 60 + 30, 18 * 60 + 30, 19 * 60 + 30];
  return groups.flatMap((group, groupIndex) => fixturePairs.map(([firstIndex, secondIndex], roundIndex) => {
    const startMinutes = startMinutesByRound[roundIndex] + Math.floor(groupIndex / 6) * 20;
    const scheduledTime = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
    return {
      id: `match-${group.id}-${roundIndex + 1}`,
      round: roundIndex + 1,
      position: roundIndex,
      participant1Id: group.participantIds[firstIndex],
      participant2Id: group.participantIds[secondIndex],
      score1: 0,
      score2: 0,
      winnerId: null,
      status: 'SCHEDULED' as const,
      nextMatchId: null,
      bracketType: 'UPPER' as const,
      scheduleRoundLabel: roundLabels[roundIndex],
      scheduledTime,
      durationMinutes: 20,
      screenNumber: (groupIndex % 6) + 1
    };
  }));
};

export const createCDPFifa27Tournament = (): Tournament => {
  const participants: Participant[] = GROUP_MEMBERS.flat().map((name, index) => ({
    id: uuidv4(),
    name,
    seed: index + 1,
    points: 0,
    wins: 0,
    losses: 0
  }));
  let participantIndex = 0;
  const groups: Group[] = GROUP_MEMBERS.map((members, index) => ({
    id: `cdp-fifa-27-group-${String.fromCharCode(65 + index)}`,
    name: `Group ${String.fromCharCode(65 + index)}`,
    participantIds: members.map(() => participants[participantIndex++].id),
    standings: []
  }));
  const id = uuidv4();
  return {
    id,
    name: CDP_FIFA_27_NAME,
    format: 'GROUP_SINGLE',
    status: 'DRAFT',
    participants,
    groups,
    groupMatches: createCDPFifa27Schedule(groups),
    bracket: [],
    config: {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tieBreakers: ['goalDiff', 'headToHead', 'goalsScored'],
      groupSize: 3,
      matchesPerParticipant: 2,
      qualifiersPerGroup: 2,
      bestThirdPlaceQualifiers: 0,
      bracketSeeding: 'SEEDED',
      randomDrawOrder: participants.map(participant => participant.id)
    }
  };
};
