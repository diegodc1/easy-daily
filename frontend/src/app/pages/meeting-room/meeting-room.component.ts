import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { DailyService } from '../../core/services/daily.service';
import { AuthService } from '../../core/services/auth.service';
import { Daily, MeetingParticipant, MeetingSession, PROTOCOL_TYPES } from '../../core/models/models';

type TaskGroup = {
  projectName: string;
  tasks: string[];
  percentSpent: number | null;
};

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meeting-room.component.html',
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  selectedDate = this.getLocalDateKey();
  state: MeetingSession | null = null;
  loading = false;
  actionLoading = false;
  startRandomize = false;
  errorMessage = '';
  successMessage = '';
  private pollId: ReturnType<typeof setInterval> | null = null;
  private lastSpeakerUserId: number | null | undefined = undefined;
  private displayedSpeakerUserId: number | null = null;
  private pendingSpeakerUserId: number | null = null;
  private lastMeetingStatus: MeetingSession['status'] | null = null;
  finishedCelebrating = false;
  sortAnimating = false;
  sortPhase: 'rapid' | 'slow' = 'rapid';
  sortDisplayName = '';
  sortPrevName = '';
  sortNextName = '';
  revealAnimating = false;
  revealName = '';
  private sortStepTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private sortStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private revealHideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private finishedHideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private sortCandidates: string[] = [];
  private sortIndex = 0;

  constructor(public auth: AuthService, private dailyService: DailyService) {}

  ngOnInit(): void {
    this.loadState();
    this.pollId = setInterval(() => this.loadState(true), 3000);
  }

  ngOnDestroy(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
    this.clearSortAnimationTimers();
  }

  onDateChange(): void {
    this.loadState();
  }

  loadState(silent = false): void {
    if (!silent) this.loading = true;
    this.dailyService.getMeetingState(this.selectedDate).pipe(catchError(() => of(null))).subscribe(res => {
      if (!silent) this.loading = false;
      if (!res) {
        if (!silent) this.errorMessage = 'Nao foi possivel carregar o modo reuniao.';
        return;
      }
      this.applyState(res, this.lastSpeakerUserId !== undefined);
      if (!silent) this.errorMessage = '';
    });
  }

  startMeeting(): void {
    if (!this.auth.isAdmin() || this.actionLoading) return;
    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.dailyService.startMeeting(this.selectedDate, this.startRandomize).pipe(catchError(() => of(null))).subscribe(res => {
      this.actionLoading = false;
      if (!res) {
        this.errorMessage = 'Nao foi possivel iniciar a reuniao para esta data.';
        return;
      }
      this.applyState(res, true);
      this.successMessage = res.orderMode === 'ORDERED'
        ? 'Reuniao iniciada em ordem fixa.'
        : 'Reuniao iniciada e primeiro participante sorteado.';
    });
  }

  nextTurn(): void {
    if (!this.auth.isAdmin() || this.actionLoading || this.state?.status !== 'IN_PROGRESS') return;
    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const randomize = this.isRandomOrder(this.state);
    this.dailyService.nextMeetingTurn(this.selectedDate, randomize).pipe(catchError(() => of(null))).subscribe(res => {
      this.actionLoading = false;
      if (!res) {
        this.errorMessage = 'Nao foi possivel sortear o proximo participante.';
        return;
      }
      this.applyState(res, true);
      this.successMessage = res.status === 'FINISHED'
        ? 'Rodada finalizada. Todos os participantes falaram.'
        : 'Proximo participante sorteado.';
    });
  }

  finishMyTurn(): void {
    if (this.actionLoading || !this.state?.canFinishCurrentTurn) return;
    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.dailyService.finishMeetingTurn(this.selectedDate).pipe(catchError(() => of(null))).subscribe(res => {
      this.actionLoading = false;
      if (!res) {
        this.errorMessage = 'Nao foi possivel finalizar a vez atual.';
        return;
      }
      this.applyState(res, true);
      this.successMessage = res.status === 'FINISHED'
        ? 'Sua vez foi finalizada. Rodada concluida.'
        : 'Vez finalizada. Proximo participante sorteado.';
    });
  }

  resetMeeting(): void {
    if (!this.auth.isAdmin() || this.actionLoading) return;
    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.dailyService.resetMeeting(this.selectedDate).pipe(catchError(() => of(null))).subscribe(res => {
      this.actionLoading = false;
      if (!res) {
        this.errorMessage = 'Nao foi possivel reiniciar a sessao.';
        return;
      }
      this.applyState(res, false);
      this.successMessage = 'Reuniao refeita. Sessao zerada e pronta para iniciar novamente.';
    });
  }

  get currentSpeaker(): MeetingParticipant | null {
    const idToDisplay = this.currentSpeakerUserIdForView;
    if (!this.state || !idToDisplay) return null;
    return this.state.participants.find(p => p.user?.id === idToDisplay) ?? null;
  }

  get currentSpeakerUserIdForView(): number | null {
    if (this.sortAnimating) {
      return this.displayedSpeakerUserId ?? null;
    }
    return this.displayedSpeakerUserId ?? this.state?.currentSpeakerUserId ?? null;
  }

  get currentSpeakerDaily(): Daily | null {
    return this.currentSpeaker?.daily ?? null;
  }

  get yesterdayTaskGroups(): TaskGroup[] {
    const daily = this.currentSpeakerDaily;
    if (!daily) return [];
    return this.buildYesterdayGroups(daily);
  }

  get todayTaskGroups(): TaskGroup[] {
    const daily = this.currentSpeakerDaily;
    if (!daily) return [];
    return this.buildTodayGroups(daily);
  }

  get projectTimes(): { projectName: string; percentSpent: number }[] {
    return (this.currentSpeakerDaily?.projectTimes ?? [])
      .filter(pt => Number.isFinite(+pt.percentSpent) && +pt.percentSpent > 0)
      .map(pt => ({ projectName: pt.projectName, percentSpent: +pt.percentSpent }))
      .sort((a, b) => b.percentSpent - a.percentSpent);
  }

  get protocolSummary(): { type: string; value: number }[] {
    const daily = this.currentSpeakerDaily;
    if (!daily) return [];
    return PROTOCOL_TYPES.map(type => {
      const key = ('protocol' + type) as keyof Daily;
      const value = Number((daily as any)[key] ?? 0);
      return { type, value: Number.isFinite(value) ? value : 0 };
    });
  }

  get protocolTotal(): number {
    const daily = this.currentSpeakerDaily;
    if (!daily) return 0;
    if (typeof daily.totalProtocols === 'number') return daily.totalProtocols;
    return this.protocolSummary.reduce((sum, p) => sum + p.value, 0);
  }

  get isCurrentUserSpeaker(): boolean {
    const userId = this.auth.getUser()?.username;
    const speaker = this.currentSpeaker?.user?.username;
    return !!userId && !!speaker && userId === speaker;
  }

  get participantsSorted(): MeetingParticipant[] {
    if (!this.state?.participants) return [];
    return [...this.state.participants].sort((a, b) => {
      const aOrder = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.user?.fullName ?? '').localeCompare(b.user?.fullName ?? '');
    });
  }

  get eligibleParticipants(): MeetingParticipant[] {
    return this.participantsSorted.filter(p => !!p.daily);
  }

  get pendingWithoutDaily(): MeetingParticipant[] {
    return this.participantsSorted.filter(p => !p.daily);
  }

  formatDate(date: string): string {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  trackByUserId(_: number, participant: MeetingParticipant): number | string {
    return participant.user?.id ?? participant.user?.username ?? _;
  }

  private getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private applyState(next: MeetingSession, animateSpeakerChange: boolean): void {
    const previousStatus = this.lastMeetingStatus;
    this.lastMeetingStatus = next.status;
    const nextIsRandom = this.isRandomOrder(next);
    if (next.orderMode) {
      this.startRandomize = next.orderMode === 'RANDOM';
    }
    const previousSpeaker = this.lastSpeakerUserId;
    this.state = next;
    const currentSpeaker = next.currentSpeakerUserId ?? null;
    this.lastSpeakerUserId = currentSpeaker;

    // While sorting/revealing, keep UI frozen on the previous displayed speaker to avoid spoilers.
    if (this.sortAnimating || this.revealAnimating) {
      return;
    }

    const shouldAnimate =
      animateSpeakerChange &&
      nextIsRandom &&
      next.status === 'IN_PROGRESS' &&
      currentSpeaker !== null &&
      previousSpeaker !== undefined &&
      previousSpeaker !== currentSpeaker;

    if (shouldAnimate) {
      if (previousSpeaker !== null) {
        this.displayedSpeakerUserId = previousSpeaker;
      }
      this.runSortAnimation(next, currentSpeaker);
      return;
    }

    this.displayedSpeakerUserId = currentSpeaker;

    const justFinished = animateSpeakerChange && previousStatus === 'IN_PROGRESS' && next.status === 'FINISHED';
    if (justFinished) {
      this.runFinishedCelebration();
    }
  }

  private runSortAnimation(state: MeetingSession, speakerId: number): void {
    this.clearSortAnimationTimers();

    const eligibleNames = state.participants
      .filter(p => !!p.daily)
      .map(p => p.user.fullName)
      .filter(Boolean);
    const finalName = state.participants.find(p => p.user.id === speakerId)?.user.fullName ?? 'Participante selecionado';
    if (eligibleNames.length === 0) return;

    this.sortCandidates = this.shuffleNames([...eligibleNames]);
    this.sortIndex = Math.floor(Math.random() * this.sortCandidates.length);
    this.sortAnimating = true;
    this.sortPhase = 'rapid';
    this.revealAnimating = false;
    this.updateSortWindow();

    const startedAt = Date.now();
    const totalDurationMs = 2200;
    const loop = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / totalDurationMs);
      this.sortPhase = progress < 0.68 ? 'rapid' : 'slow';
      this.sortIndex = (this.sortIndex + 1) % this.sortCandidates.length;
      this.updateSortWindow();

      if (progress >= 1) {
        this.sortStopTimeoutId = setTimeout(() => {
          this.sortAnimating = false;
          this.pendingSpeakerUserId = speakerId;
          this.revealName = finalName;
          this.revealAnimating = true;
          this.revealHideTimeoutId = setTimeout(() => {
            this.revealAnimating = false;
            if (this.pendingSpeakerUserId !== null) {
              this.displayedSpeakerUserId = this.pendingSpeakerUserId;
            }
            this.pendingSpeakerUserId = null;
          }, 1800);
        }, 120);
        return;
      }

      const nextDelay = Math.round(45 + Math.pow(progress, 2.25) * 240);
      this.sortStepTimeoutId = setTimeout(loop, nextDelay);
    };
    loop();
  }

  private clearSortAnimationTimers(): void {
    if (this.sortStepTimeoutId) {
      clearTimeout(this.sortStepTimeoutId);
      this.sortStepTimeoutId = null;
    }
    if (this.sortStopTimeoutId) {
      clearTimeout(this.sortStopTimeoutId);
      this.sortStopTimeoutId = null;
    }
    if (this.revealHideTimeoutId) {
      clearTimeout(this.revealHideTimeoutId);
      this.revealHideTimeoutId = null;
    }
    if (this.finishedHideTimeoutId) {
      clearTimeout(this.finishedHideTimeoutId);
      this.finishedHideTimeoutId = null;
    }
    this.sortAnimating = false;
    this.sortPhase = 'rapid';
    this.sortDisplayName = '';
    this.sortPrevName = '';
    this.sortNextName = '';
    this.revealAnimating = false;
    this.pendingSpeakerUserId = null;
  }

  private runFinishedCelebration(): void {
    this.finishedCelebrating = true;
    if (this.finishedHideTimeoutId) {
      clearTimeout(this.finishedHideTimeoutId);
    }
    this.finishedHideTimeoutId = setTimeout(() => {
      this.finishedCelebrating = false;
    }, 2600);
  }

  private updateSortWindow(): void {
    if (this.sortCandidates.length === 0) return;
    const len = this.sortCandidates.length;
    const curr = ((this.sortIndex % len) + len) % len;
    const prev = (curr - 1 + len) % len;
    const next = (curr + 1) % len;
    this.sortPrevName = this.sortCandidates[prev];
    this.sortDisplayName = this.sortCandidates[curr];
    this.sortNextName = this.sortCandidates[next];
  }

  private shuffleNames(input: string[]): string[] {
    for (let i = input.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = input[i];
      input[i] = input[j];
      input[j] = temp;
    }
    return input;
  }

  private isRandomOrder(session: MeetingSession | null | undefined): boolean {
    if (session?.orderMode) {
      return session.orderMode === 'RANDOM';
    }
    return this.startRandomize;
  }

  private buildYesterdayGroups(daily: Daily): TaskGroup[] {
    const percentMap = this.projectPercentMap(daily);
    if ((daily.tasks ?? []).length > 0) {
      const grouped = new Map<string, string[]>();
      for (const task of daily.tasks ?? []) {
        const project = (task.projectName ?? '').trim();
        const description = (task.description ?? '').trim();
        if (!project || !description) continue;
        if (!grouped.has(project)) grouped.set(project, []);
        grouped.get(project)!.push(description);
      }
      return Array.from(grouped.entries()).map(([projectName, tasks]) => ({
        projectName,
        tasks,
        percentSpent: percentMap.get(projectName) ?? null,
      }));
    }
    return this.parseTaskGroups(daily.doneYesterday, percentMap);
  }

  private buildTodayGroups(daily: Daily): TaskGroup[] {
    const percentMap = this.projectPercentMap(daily);
    return this.parseTaskGroups(daily.doingToday, percentMap);
  }

  private parseTaskGroups(rawText: string | null | undefined, percentMap: Map<string, number>): TaskGroup[] {
    const grouped = new Map<string, string[]>();
    const lines = (rawText ?? '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^- \[(.+?)\]\s+(.+)$/);
      if (!match) continue;
      const project = match[1].trim();
      const description = match[2].trim();
      if (!project || !description) continue;
      if (!grouped.has(project)) grouped.set(project, []);
      grouped.get(project)!.push(description);
    }

    return Array.from(grouped.entries()).map(([projectName, tasks]) => ({
      projectName,
      tasks,
      percentSpent: percentMap.get(projectName) ?? null,
    }));
  }

  private projectPercentMap(daily: Daily): Map<string, number> {
    const map = new Map<string, number>();
    for (const pt of daily.projectTimes ?? []) {
      const projectName = (pt.projectName ?? '').trim();
      const percent = Number(pt.percentSpent);
      if (!projectName || !Number.isFinite(percent)) continue;
      map.set(projectName, percent);
    }
    return map;
  }
}
