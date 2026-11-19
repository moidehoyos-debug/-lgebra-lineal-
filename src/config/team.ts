export interface OfficialTeamMember {
  readonly id: string;
  readonly orderNumber: string;
  readonly name: string;
  readonly role?: string;
}

export const OFFICIAL_TEAM_NAMES = [
  'Moisés de Hoyos',
  'Isaías Alvarado',
  'Rivaldo Calvo',
] as const;

export const OFFICIAL_TEAM_MEMBERS: readonly OfficialTeamMember[] = [
  {
    id: 'member-01',
    orderNumber: '01',
    name: OFFICIAL_TEAM_NAMES[0],
  },
  {
    id: 'member-02',
    orderNumber: '02',
    name: OFFICIAL_TEAM_NAMES[1],
  },
  {
    id: 'member-03',
    orderNumber: '03',
    name: OFFICIAL_TEAM_NAMES[2],
  },
] as const;
