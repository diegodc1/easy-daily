export const DEFAULT_PROJECT_COLORS = [
  '#00e5a0','#3b82f6','#f59e0b','#f43f5e',
  '#a855f7','#06b6d4','#84cc16','#f97316',
];

export const PROTOCOL_TYPES = ['FA','IMP','DE','DI','CO'] as const;
export type ProtocolType = typeof PROTOCOL_TYPES[number];

export const PROTOCOL_COLORS: Record<string, string> = {
  FA:  '#00e5a0',
  IMP: '#3b82f6',
  DE:  '#f59e0b',
  DI:  '#f43f5e',
  CO:  '#a855f7',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  FA:  'FA — Falha',
  IMP: 'IMP — Implementação',
  DE:  'DE — Implementação Desenvolvimento',
  DI:  'DI — Desenvolvimento Interno',
  CO:  'CO — Consulta',
};

export interface ProtocolCounts {
  FA:  number;
  IMP: number;
  DE:  number;
  DI:  number;
  CO:  number;
}

export interface AppProject {
  id: number; name: string; color: string; active: boolean; sortOrder: number;
}

export interface User {
  id: number; username: string; fullName: string; email: string;
  bitrixId?: string;
  role: 'ADMIN' | 'MEMBER'; active: boolean;
}

export interface ProjectTime {
  id?: number; projectName: string; percentSpent: number;
}

export interface DailyTask {
  id?: number;
  projectName: string;
  description: string;
  hoursSpent: number;
}

export interface Daily {
  id?: number;
  dailyDate: string;
  doneYesterday: string;
  doingToday: string;
  blockers: string;
  hasBlocker: boolean;
  protocolFA:  number;
  protocolIMP: number;
  protocolDE:  number;
  protocolDI:  number;
  protocolCO:  number;
  totalProtocols?: number;   // computed by backend
  user?: User;
  projectTimes: ProjectTime[];
  tasks?: DailyTask[];
  createdAt?: string;
  canEdit?: boolean;
  editRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export interface DailyByDate {
  date: string;
  dailies: Daily[];
  totalMembers: number;
  membersWithBlockers: number;
  totalProtocols: number;
  pendingUsers: User[];
}

export interface PendingResponse {
  date: string; pending: User[]; submitted: User[]; total: number; submittedCount: number;
}

export interface DailyEditRequest {
  id: number;
  dailyId: number;
  dailyDate: string;
  requestedBy: User;
  reviewedBy?: User;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  note?: string;
  createdAt?: string;
  reviewedAt?: string;
  usedAt?: string;
}

export interface LoginRequest  { username: string; password: string; }
export interface LoginResponse { token: string; username: string; fullName: string; role: string; bitrixId?: string; }
export interface UserRequest   { username: string; password: string; fullName: string; email: string; bitrixId?: string; role: string; }
export interface ProjectRequest { name: string; color: string; sortOrder: number; }
export interface UserProjectPreferences { projectIds: number[]; }
