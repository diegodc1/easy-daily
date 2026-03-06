export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  active: boolean;
}

export interface ProjectTime {
  id?: number;
  projectName: string;
  hoursSpent: number;
  protocolCount: number;
}

export interface Daily {
  id?: number;
  dailyDate: string;
  doneYesterday: string;
  doingToday: string;
  blockers: string;
  hasBlocker: boolean;
  user?: User;
  projectTimes: ProjectTime[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyByDate {
  date: string;
  dailies: Daily[];
  totalMembers: number;
  membersWithBlockers: number;
  totalHours: number;
  totalProtocols: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
}

export interface UserRequest {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: string;
}
