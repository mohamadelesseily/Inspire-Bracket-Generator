import { v4 as uuidv4 } from 'uuid';
import type { Group, Match, Participant, Tournament } from '../types/tournament';

export const CDP_FIFA_27_NAME = 'CDP FIFA 27';

const GROUP_MEMBERS = [
  ['Mark Peter', 'Karim Barakat', 'Ahmed Hassan'],
  ['Omar Emad', 'Ismail Zaghloul', 'Ahmed Hany'],
  ['Abdelrahman Osama', 'Mohammad Moustafa', 'Ahmad Eljbour'],
  ['Mohamed Hani', 'Saleh', 'Youssef Ismail'],
  ['Abdelrahman Alaa', 'Mohamed Eid', 'Youssef Hossam'],
  ['Omar Dabour', 'Kareem Sameh', 'Mohamed Mohen'],
  ['Omar Soliman', 'Omar Mohamed', 'Abdulaziz Mahmud'],
  ['Omar Fathy', 'Moaz Sabbah', 'Mohamed Sayed'],
  ['Eyad Yasser', 'Youssef Adel', 'Mohamed Yousseff'],
  ['Kareem Ehab', 'Hazem Zidane', 'AbdelRahman Yassin'],
  ['Hatem Elabd', 'Osama Ragaei', 'Youssef Fawzy'],
  ['Youssef Tamer', 'Omar Tamer', 'Yassin Badrr'],
  ['Kirollos Awny', 'John Fady', 'Omar Shaarawy'],
  ['Omar Zaher', 'Marwan Walid', 'Yehia Tamer'],
  ['Karim Saad', 'Seif', 'Youssef Mashaly'],
  ['Malek Khaled', 'Youssef Samy', 'Omar Abdelghany']
];

const GROUP_MEMBER_ALIASES: Record<string, string[]> = {
  'Ahmad Eljbour': ['Ahmad Moeen Eljbour'],
  'Mohamed Mohen': ['Mohamed El Mohen'],
  'Moaz Sabbah': ['Moaz Ahmed Sabbah'],
  'Youssef Adel': ['Youssef Mohamed Adel'],
  'Mohamed Yousseff': ['Mohamed Youssef*'],
  'Hatem Elabd': ['Hatem Ahmed Elsayed Ali Mohamed Youssef Elabd'],
  'Youssef Fawzy': ['Youssef Mohamed Fawzy'],
  'Karim Saad': ['Karim Mohamed Saad']
};

const normalizeName = (name: string) => name.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');

export const createCDPFifa27Schedule = (groups: Group[], participants: Participant[] = []): Match[] => {
  const fixturePairsByGroup: [number, number][][] = groups.map((_, index) => {
    if (index === 6) return [[1, 2], [0, 1], [0, 2]]; // Group G
    if (index === 7) return [[0, 2], [1, 2], [0, 1]]; // Group H
    if (index === 14) return [[1, 2], [0, 1], [0, 2]]; // Group O
    if (index === 15) return [[0, 2], [1, 2], [0, 1]]; // Group P
    return [[0, 1], [0, 2], [1, 2]];
  });
  // Each row is a 20 minute slot; its six entries map to Screens 1–6.
  const scheduleSlots: Array<[string, number[]]> = [
    ['17:00', [0, 6, 7, 8, 14, 15]],
    ['17:20', [0, 1, 7, 8, 9, 15]],
    ['17:40', [0, 1, 2, 8, 9, 10]],
    ['18:00', [1, 2, 3, 9, 10, 11]],
    ['18:20', [2, 3, 4, 10, 11, 12]],
    ['18:40', [3, 4, 5, 11, 12, 13]],
    ['19:00', [4, 5, 6, 12, 13, 14]],
    ['19:20', [5, 6, 7, 13, 14, 15]]
  ];
  const scheduledFixtures = new Map<number, { time: string; screen: number }>();
  const fixtureRoundByGroup = new Map<number, number>();
  scheduleSlots.forEach(([time, groupIndexes]) => {
    groupIndexes.forEach((groupIndex, screenIndex) => {
      const roundIndex = fixtureRoundByGroup.get(groupIndex) ?? 0;
      const fixtureIndex = groupIndex * 3 + roundIndex;
      scheduledFixtures.set(fixtureIndex, { time, screen: screenIndex + 1 });
      fixtureRoundByGroup.set(groupIndex, roundIndex + 1);
    });
  });
  return groups.flatMap((group, groupIndex) => {
    const participantIds = GROUP_MEMBERS[groupIndex]?.map(expectedName => {
      const acceptedNames = new Set([expectedName, ...(GROUP_MEMBER_ALIASES[expectedName] ?? [])].map(normalizeName));
      return group.participantIds.find(participantId => {
        const participantName = participants.find(participant => participant.id === participantId)?.name;
        return participantName ? acceptedNames.has(normalizeName(participantName)) : false;
      });
    });
    const orderedParticipantIds = participantIds?.every((id): id is string => Boolean(id))
      ? participantIds
      : group.participantIds;
    return fixturePairsByGroup[groupIndex].map(([firstIndex, secondIndex], roundIndex) => {
    const fixtureIndex = groupIndex * 3 + roundIndex;
    const scheduled = scheduledFixtures.get(fixtureIndex);
    return {
      id: `match-${group.id}-${roundIndex + 1}`,
      round: roundIndex + 1,
      position: roundIndex,
      participant1Id: orderedParticipantIds[firstIndex],
      participant2Id: orderedParticipantIds[secondIndex],
      score1: 0,
      score2: 0,
      winnerId: null,
      status: 'SCHEDULED' as const,
      nextMatchId: null,
      bracketType: 'UPPER' as const,
      scheduleRoundLabel: `${group.name} match ${roundIndex + 1}`,
      scheduledTime: scheduled?.time,
      durationMinutes: 20,
      screenNumber: scheduled?.screen
    };
    });
  });
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
    groupMatches: createCDPFifa27Schedule(groups, participants),
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
