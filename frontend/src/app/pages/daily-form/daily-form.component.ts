import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import {
  Daily,
  DailyTask,
  ProjectTime,
  AppProject,
  PROTOCOL_TYPES,
  PROTOCOL_COLORS,
  PROTOCOL_LABELS,
} from '../../core/models/models';
import { catchError, of } from 'rxjs';
import { notifyDailyDone } from '../../core/electron-helper';
import tippy, { type Instance } from 'tippy.js';

@Component({
  selector: 'app-daily-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-form.component.html',
})
export class DailyFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('replicateBtn') replicateBtn?: ElementRef<HTMLElement>;
  @ViewChild('pullPreBtn') pullPreBtn?: ElementRef<HTMLElement>;

  selectedDate = new Date().toISOString().slice(0, 10);
  todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  projects: AppProject[] = [];
  visibleProjectIds: number[] = [];
  selectedTaskProject = '';
  selectedTodayProject = '';
  taskProjects: string[] = [];
  todayProjects: string[] = [];
  todayTasks: { projectName: string; description: string }[] = [];
  form: Daily = this.emptyForm();
  private draftIntervalId: any = null;

  saveSuccess = false;
  saveError = '';
  loading = false;

  isExistingDaily = false;
  canEditCurrentDaily = true;
  editRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null = null;
  requestReason = '';
  requestLoading = false;
  requestError = '';
  requestSuccess = '';
  protocolSyncLoading = false;
  protocolSyncMessage = '';
  showReplicateModal = false;
  showPullPreDailyModal = false;
  replicateLoading = false;
  pullPreDailyLoading = false;
  showRemoveProjectModal = false;
  showRemoveTodayProjectModal = false;
  projectToRemove: string | null = null;
  private tooltipInstances: Instance[] = [];

  readonly protocolTypes = PROTOCOL_TYPES;
  readonly protocolColors = PROTOCOL_COLORS;
  readonly protocolLabels = PROTOCOL_LABELS;

  constructor(private svc: DailyService) {}

  ngOnInit() {
    this.svc.getActiveProjects().pipe(catchError(() => of([]))).subscribe(p => {
      this.projects = p;
      this.svc.getDailyProjectPreferences().pipe(catchError(() => of({ projectIds: p.map(x => x.id) }))).subscribe(pref => {
        this.applyVisibleProjects(pref.projectIds ?? []);
        this.ensureSelectedProjects();
        this.loadForDate();
        this.startDraftAutosave();
      });
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initTooltips(), 0);
  }

  ngOnDestroy(): void {
    this.destroyTooltips();
    if (this.draftIntervalId) {
      clearInterval(this.draftIntervalId);
      this.draftIntervalId = null;
    }
  }

  get visibleProjects(): AppProject[] {
    const visibleSet = new Set(this.visibleProjectIds);
    return this.projects.filter(p => visibleSet.has(p.id));
  }

  get visibleTaskProjects(): string[] {
    return this.taskProjects.filter(projectName => this.isVisibleProjectName(projectName));
  }

  get visibleTodayProjects(): string[] {
    return this.todayProjects.filter(projectName => this.isVisibleProjectName(projectName));
  }

  get visibleProjectTimes(): ProjectTime[] {
    return this.form.projectTimes.filter(pt => this.isVisibleProjectName(pt.projectName));
  }

  emptyForm(): Daily {
    return {
      dailyDate: this.selectedDate,
      doneYesterday: '',
      doingToday: '',
      blockers: '',
      hasBlocker: false,
      protocolFA: 0,
      protocolIMP: 0,
      protocolDE: 0,
      protocolDI: 0,
      protocolCO: 0,
      projectTimes: this.projects.map(p => ({ projectName: p.name, percentSpent: 0 })),
      tasks: [],
    };
  }

  loadForDate() {
    this.form = {
      ...this.emptyForm(),
      dailyDate: this.selectedDate,
      projectTimes: this.projects.map(p => ({ projectName: p.name, percentSpent: 0 })),
      tasks: [],
    };
    this.taskProjects = [];
    this.todayProjects = [];
    this.todayTasks = [];
    this.isExistingDaily = false;
    this.canEditCurrentDaily = true;
    this.editRequestStatus = null;
    this.requestError = '';
    this.requestSuccess = '';
    this.protocolSyncLoading = false;
    this.protocolSyncMessage = '';

    // tenta restaurar rascunho local para a data atual (antes de chamar a API)
    this.loadDraftIfAny();

    this.svc.getByDate(this.selectedDate).pipe(catchError(() => of(null))).subscribe(d => {
      if (!d) {
        this.tryLoadTodayProtocols();
        return;
      }
      this.applyDailyData(d);
      if (this.isTodaySelected()) {
        notifyDailyDone();
      }
      this.clearDraft();
    });
  }

  onDateChange() {
    this.loadForDate();
  }

  openReplicateModal() {
    if (this.loading || this.isEditLocked) return;
    this.saveError = '';
    this.showReplicateModal = true;
  }

  closeReplicateModal() {
    if (this.replicateLoading) return;
    this.showReplicateModal = false;
  }

  confirmReplicatePreviousDay() {
    if (this.replicateLoading) return;
    this.replicateLoading = true;
    this.saveError = '';

    const previousDate = this.getPreviousDate(this.selectedDate);
    this.svc.getByDate(previousDate).pipe(catchError(() => of(null))).subscribe(prev => {
      this.replicateLoading = false;
      this.showReplicateModal = false;
      if (!prev) {
        this.saveError = `Nao existe daily em ${this.formatDatePtBr(previousDate)} para replicar.`;
        return;
      }

      // Replicate content only; keep current selected date and current edit-permission context
      this.form = {
        ...this.form,
        doneYesterday: prev.doneYesterday ?? '',
        doingToday: prev.doingToday ?? '',
        blockers: prev.blockers ?? '',
        hasBlocker: !!prev.hasBlocker,
        projectTimes: this.projects.map(p => prev.projectTimes?.find(x => x.projectName === p.name) ?? { projectName: p.name, percentSpent: 0 }),
        tasks: (prev.tasks ?? []).map(t => ({ ...t })),
      };
      this.syncTaskProjectsFromTasks();
      this.todayTasks = this.parseDoingToday(prev.doingToday);
      this.syncTodayProjectsFromTasks();
      this.ensureSelectedProjects();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
  }

  pullPreDaily() {
    if (this.pullPreDailyLoading) return;
    this.pullPreDailyLoading = true;
    this.saveError = '';

    this.svc.getPreDaily().pipe(catchError(() => of(null))).subscribe(pre => {
      this.pullPreDailyLoading = false;
      if (!pre) {
        this.saveError = 'Nao existe pre-daily registrada para puxar.';
        return;
      }

      const tasks: DailyTask[] = (pre.tasks ?? [])
        .filter(t => !!t.projectName && (t.description ?? '').trim().length > 0)
        .map(t => ({
          projectName: t.projectName,
          description: (t.description ?? '').trim(),
          hoursSpent: 0,
        }));

      this.form.tasks = tasks;
      this.syncTaskProjectsFromTasks();

      this.form.doneYesterday = tasks.map(t => `- [${t.projectName}] ${t.description}`).join('\n');
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
  }

  openPullPreDailyModal() {
    if (this.loading || this.isEditLocked || this.pullPreDailyLoading) return;
    this.saveError = '';
    this.showPullPreDailyModal = true;
  }

  closePullPreDailyModal() {
    if (this.pullPreDailyLoading) return;
    this.showPullPreDailyModal = false;
  }

  confirmPullPreDaily() {
    if (this.pullPreDailyLoading) return;
    this.showPullPreDailyModal = false;
    this.pullPreDaily();
  }

  private tryLoadTodayProtocols() {
    if (!this.isTodaySelected()) return;
    this.protocolSyncLoading = true;
    this.protocolSyncMessage = '';
    this.svc.getTodayProtocols().pipe(catchError(() => of(null))).subscribe(protocols => {
      this.protocolSyncLoading = false;
      if (!protocols) {
        this.protocolSyncMessage = 'Nao foi possivel buscar protocolos automaticamente. Preencha manualmente.';
        return;
      }
      this.form.protocolFA = protocols.FA ?? 0;
      this.form.protocolIMP = protocols.IMP ?? 0;
      this.form.protocolDE = protocols.DE ?? 0;
      this.form.protocolDI = protocols.DI ?? 0;
      this.form.protocolCO = protocols.CO ?? 0;
      this.protocolSyncMessage = 'Protocolos do dia carregados automaticamente.';
    });
  }

  private isTodaySelected(): boolean {
    return this.selectedDate === new Date().toISOString().slice(0, 10);
  }

  private getPreviousDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private formatDatePtBr(dateStr: string): string {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  }

  get isEditLocked(): boolean {
    return this.isExistingDaily && !this.canEditCurrentDaily;
  }

  private syncTaskProjectsFromTasks() {
    const unique = new Set((this.form.tasks ?? []).map(t => t.projectName).filter(Boolean));
    this.taskProjects = Array.from(unique);
  }

  private syncTodayProjectsFromTasks() {
    const unique = new Set((this.todayTasks ?? []).map(t => t.projectName).filter(Boolean));
    this.todayProjects = Array.from(unique);
  }

  private applyVisibleProjects(projectIds: number[]) {
    const activeIds = this.projects.map(p => p.id);
    const filtered = (projectIds ?? [])
      .filter(id => activeIds.includes(id))
      .filter((id, index, arr) => arr.indexOf(id) === index);
    this.visibleProjectIds = filtered.length > 0 ? filtered : activeIds;
  }

  private ensureSelectedProjects() {
    const firstVisibleName = this.visibleProjects[0]?.name ?? '';
    if (!this.selectedTaskProject || !this.isVisibleProjectName(this.selectedTaskProject)) {
      this.selectedTaskProject = firstVisibleName;
    }
    if (!this.selectedTodayProject || !this.isVisibleProjectName(this.selectedTodayProject)) {
      this.selectedTodayProject = firstVisibleName;
    }
  }

  private isVisibleProjectName(projectName: string): boolean {
    const p = this.projects.find(x => x.name === projectName);
    return !!p && this.visibleProjectIds.includes(p.id);
  }

  addProjectBlock() {
    if (!this.selectedTaskProject) return;
    if (!this.taskProjects.includes(this.selectedTaskProject)) {
      this.taskProjects.push(this.selectedTaskProject);
    }
    if (this.getTasksByProject(this.selectedTaskProject).length === 0) {
      this.addTask(this.selectedTaskProject);
    }
  }

  removeProjectBlock(projectName: string) {
    this.projectToRemove = projectName;
    this.showRemoveProjectModal = true;
  }

  confirmRemoveProjectBlock() {
    if (!this.projectToRemove) return;
    const projectName = this.projectToRemove;
    this.taskProjects = this.taskProjects.filter(p => p !== projectName);
    this.form.tasks = (this.form.tasks ?? []).filter(t => t.projectName !== projectName);
    this.setProjectPercent(projectName, 0);
    this.projectToRemove = null;
    this.showRemoveProjectModal = false;
  }

  cancelRemoveProjectBlock() {
    this.projectToRemove = null;
    this.showRemoveProjectModal = false;
  }

  getTasksByProject(projectName: string): DailyTask[] {
    return (this.form.tasks ?? []).filter(t => t.projectName === projectName);
  }

  addTask(projectName: string) {
    if (!projectName) return;
    if (!this.form.tasks) this.form.tasks = [];
    if (!this.taskProjects.includes(projectName)) {
      this.taskProjects.push(projectName);
    }
    this.form.tasks.push({
      projectName,
      description: '',
      hoursSpent: 0,
      hoursInput: '',
    } as any);
  }

  removeTask(task: DailyTask) {
    if (!this.form.tasks) return;
    this.form.tasks = this.form.tasks.filter(t => t !== task);
  }

  addTodayProjectBlock() {
    if (!this.selectedTodayProject) return;
    if (!this.todayProjects.includes(this.selectedTodayProject)) {
      this.todayProjects.push(this.selectedTodayProject);
    }
    if (this.getTodayTasksByProject(this.selectedTodayProject).length === 0) {
      this.addTodayTask(this.selectedTodayProject);
    }
  }

  removeTodayProjectBlock(projectName: string) {
    this.projectToRemove = projectName;
    this.showRemoveTodayProjectModal = true;
  }

  confirmRemoveTodayProjectBlock() {
    if (!this.projectToRemove) return;
    const projectName = this.projectToRemove;
    this.todayProjects = this.todayProjects.filter(p => p !== projectName);
    this.todayTasks = (this.todayTasks ?? []).filter(t => t.projectName !== projectName);
    this.projectToRemove = null;
    this.showRemoveTodayProjectModal = false;
  }

  cancelRemoveTodayProjectBlock() {
    this.projectToRemove = null;
    this.showRemoveTodayProjectModal = false;
  }

  getTodayTasksByProject(projectName: string): { projectName: string; description: string }[] {
    return (this.todayTasks ?? []).filter(t => t.projectName === projectName);
  }

  addTodayTask(projectName: string) {
    if (!projectName) return;
    if (!this.todayTasks) this.todayTasks = [];
    if (!this.todayProjects.includes(projectName)) {
      this.todayProjects.push(projectName);
    }
    this.todayTasks.push({ projectName, description: '' });
  }

  removeTodayTask(task: { projectName: string; description: string }) {
    if (!this.todayTasks) return;
    this.todayTasks = this.todayTasks.filter(t => t !== task);
  }

  private parseDoingToday(text: string | null | undefined): { projectName: string; description: string }[] {
    const raw = (text ?? '').trim();
    if (!raw) return [];

    const parsed = raw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^- \[(.+?)\]\s+(.+)$/);
        if (!match) return null;
        return { projectName: match[1].trim(), description: match[2].trim() };
      })
      .filter((x): x is { projectName: string; description: string } => !!x && !!x.projectName && !!x.description);

    return parsed;
  }

  private buildDoingTodayFromTasks(tasks: { projectName: string; description: string }[]): string {
    return tasks.map(t => `- [${t.projectName}] ${t.description}`).join('\n');
  }

  getProjectPercent(projectName: string): number {
    return this.projectTimeFor(projectName).percentSpent;
  }

  setProjectPercent(projectName: string, value: number | string | null | undefined) {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const clamped = Math.max(0, Math.min(100, safe));
    this.projectTimeFor(projectName).percentSpent = clamped;
  }

  private projectTimeFor(projectName: string): ProjectTime {
    let pt = this.form.projectTimes.find(x => x.projectName === projectName);
    if (!pt) {
      pt = { projectName, percentSpent: 0 };
      this.form.projectTimes.push(pt);
    }
    return pt;
  }

  requestEditPermission() {
    if (!this.isExistingDaily) {
      this.requestError = 'Nao existe daily para solicitar alteracao nesta data.';
      return;
    }

    this.requestLoading = true;
    this.requestError = '';
    this.requestSuccess = '';

    this.svc.requestEditPermission(this.selectedDate, this.requestReason).pipe(
      catchError(() => {
        this.requestError = 'Nao foi possivel enviar a solicitacao.';
        this.requestLoading = false;
        return of(null);
      })
    ).subscribe(res => {
      this.requestLoading = false;
      if (!res) return;
      this.editRequestStatus = res.status;
      this.canEditCurrentDaily = res.status === 'APPROVED';
      this.requestSuccess = res.status === 'PENDING'
        ? 'Solicitacao enviada. Aguarde aprovacao do admin.'
        : 'Voce ja possui uma aprovacao ativa para alterar esta daily.';
    });
  }

  getProtocol(type: string): number {
    return (this.form as any)['protocol' + type] ?? 0;
  }

  setProtocol(type: string, val: number) {
    (this.form as any)['protocol' + type] = val < 0 ? 0 : val;
  }

  totalProtocols(): number {
    return ['FA', 'IMP', 'DE', 'DI', 'CO'].reduce((s, t) => s + (this.getProtocol(t) || 0), 0);
  }

  totalPct(): number {
    return this.visibleProjectTimes.reduce((s, p) => s + (+p.percentSpent || 0), 0);
  }

  pctWarning(): boolean {
    return this.totalPct() > 100;
  }

  save() {
    if (this.isEditLocked) {
      this.saveError = 'Esta daily esta bloqueada para alteracao ate aprovacao do admin.';
      return;
    }
    if (this.pctWarning()) {
      this.saveError = 'A soma dos percentuais nao pode ultrapassar 100%.';
      return;
    }

    const sanitizedTasks: DailyTask[] = [];
    for (const t of (this.form.tasks ?? [])) {
      if (!t.projectName || (t.description ?? '').trim().length === 0) continue;
      sanitizedTasks.push({
        projectName: t.projectName,
        description: t.description.trim(),
        hoursSpent: 0,
      });
    }

    const doneYesterdayFromTasks = sanitizedTasks
      .map(t => `- [${t.projectName}] ${t.description}`)
      .join('\n');

    const sanitizedTodayTasks = (this.todayTasks ?? [])
      .filter(t => !!t.projectName && (t.description ?? '').trim().length > 0)
      .map(t => ({ projectName: t.projectName, description: t.description.trim() }));
    const doingTodayFromTasks = this.buildDoingTodayFromTasks(sanitizedTodayTasks);

    this.loading = true;
    this.saveError = '';
    this.saveSuccess = false;

    this.svc.saveDaily({
      ...this.form,
      dailyDate: this.selectedDate,
      doneYesterday: doneYesterdayFromTasks,
      doingToday: doingTodayFromTasks,
      tasks: sanitizedTasks,
    }).pipe(
      catchError(() => {
        this.saveError = 'Erro ao salvar.';
        this.loading = false;
        return of(null);
      })
    ).subscribe(res => {
      this.loading = false;
      if (!res) return;
      this.applyDailyData(res);
      if (this.isTodaySelected()) {
        notifyDailyDone();
      }
      this.clearDraft();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
  }

  private applyDailyData(d: Daily) {
    this.isExistingDaily = true;
    this.canEditCurrentDaily = d.canEdit ?? false;
    this.editRequestStatus = d.editRequestStatus ?? null;
    this.form = {
      ...d,
      projectTimes: this.projects.map(p => d.projectTimes?.find(x => x.projectName === p.name) ?? { projectName: p.name, percentSpent: 0 }),
      tasks: d.tasks ?? [],
    };
    this.syncTaskProjectsFromTasks();
    this.todayTasks = this.parseDoingToday(d.doingToday);
    this.syncTodayProjectsFromTasks();
    this.ensureSelectedProjects();
  }

  // ── Draft / localStorage ───────────────────────────────────────

  private draftKey(): string {
    return `daily-draft-${this.selectedDate}`;
  }

  private startDraftAutosave() {
    if (this.draftIntervalId) return;
    this.draftIntervalId = setInterval(() => {
      if (!this.isTodaySelected() || this.isExistingDaily) return;
      this.saveDraft();
    }, 1000);
  }

  private saveDraft() {
    try {
      const payload = {
        form: this.form,
        todayTasks: this.todayTasks,
        taskProjects: this.taskProjects,
        todayProjects: this.todayProjects,
      };
      localStorage.setItem(this.draftKey(), JSON.stringify(payload));
    } catch {
      console.error("Erro:")
    }
  }

  private loadDraftIfAny() {
    try {
      if (!this.isTodaySelected()) return;
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.form) {
        this.form = {
          ...this.emptyForm(),
          ...parsed.form,
          dailyDate: this.selectedDate,
        };
      }
      this.todayTasks = parsed?.todayTasks ?? [];
      this.taskProjects = parsed?.taskProjects ?? [];
      this.todayProjects = parsed?.todayProjects ?? [];
    } catch {
      console.error("Erro:")
    }
  }

  private clearDraft() {
    try {
      localStorage.removeItem(this.draftKey());
    } catch {
      console.error("Erro:")
    }
  }

  barWidth(p: ProjectTime): string {
    return Math.min(+p.percentSpent || 0, 100) + '%';
  }

  colorOf(name: string): string {
    return this.projects.find(p => p.name === name)?.color ?? '#888';
  }

  protocolColor(type: string): string {
    return (PROTOCOL_COLORS as any)[type] ?? '#888';
  }

  private initTooltips() {
    this.destroyTooltips();

    if (this.replicateBtn?.nativeElement) {
      this.tooltipInstances.push(
        tippy(this.replicateBtn.nativeElement, {
          content: 'Replicar daily do dia anterior',
          placement: 'top',
          maxWidth: 340,
        })
      );
    }

    if (this.pullPreBtn?.nativeElement) {
      this.tooltipInstances.push(
        tippy(this.pullPreBtn.nativeElement, {
          content: 'Carregar pre-daily',
          placement: 'top',
          maxWidth: 340,
        })
      );
    }
  }

  private destroyTooltips() {
    this.tooltipInstances.forEach(t => t.destroy());
    this.tooltipInstances = [];
  }
}
