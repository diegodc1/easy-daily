import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-daily-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-form.component.html',
})
export class DailyFormComponent implements OnInit {
  selectedDate = new Date().toISOString().slice(0, 10);
  todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  projects: AppProject[] = [];
  selectedTaskProject = '';
  taskProjects: string[] = [];
  form: Daily = this.emptyForm();

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

  readonly protocolTypes = PROTOCOL_TYPES;
  readonly protocolColors = PROTOCOL_COLORS;
  readonly protocolLabels = PROTOCOL_LABELS;

  constructor(private svc: DailyService) {}

  ngOnInit() {
    this.svc.getActiveProjects().pipe(catchError(() => of([]))).subscribe(p => {
      this.projects = p;
      this.selectedTaskProject = this.projects[0]?.name ?? '';
      this.loadForDate();
    });
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
    this.isExistingDaily = false;
    this.canEditCurrentDaily = true;
    this.editRequestStatus = null;
    this.requestError = '';
    this.requestSuccess = '';
    this.protocolSyncLoading = false;
    this.protocolSyncMessage = '';

    this.svc.getByDate(this.selectedDate).pipe(catchError(() => of(null))).subscribe(d => {
      if (!d) {
        this.tryLoadTodayProtocols();
        return;
      }
      this.isExistingDaily = true;
      this.canEditCurrentDaily = d.canEdit ?? false;
      this.editRequestStatus = d.editRequestStatus ?? null;

      this.form = {
        ...d,
        projectTimes: this.projects.map(p => d.projectTimes?.find(x => x.projectName === p.name) ?? { projectName: p.name, percentSpent: 0 }),
        tasks: d.tasks ?? [],
      };
      this.syncTaskProjectsFromTasks();
    });
  }

  onDateChange() {
    this.loadForDate();
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

  get isEditLocked(): boolean {
    return this.isExistingDaily && !this.canEditCurrentDaily;
  }

  private syncTaskProjectsFromTasks() {
    const unique = new Set((this.form.tasks ?? []).map(t => t.projectName).filter(Boolean));
    this.taskProjects = Array.from(unique);
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
    this.taskProjects = this.taskProjects.filter(p => p !== projectName);
    this.form.tasks = (this.form.tasks ?? []).filter(t => t.projectName !== projectName);
    this.setProjectPercent(projectName, 0);
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
    return this.form.projectTimes.reduce((s, p) => s + (+p.percentSpent || 0), 0);
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

    this.loading = true;
    this.saveError = '';
    this.saveSuccess = false;

    this.svc.saveDaily({
      ...this.form,
      dailyDate: this.selectedDate,
      doneYesterday: doneYesterdayFromTasks,
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

      this.isExistingDaily = true;
      this.canEditCurrentDaily = res.canEdit ?? false;
      this.editRequestStatus = res.editRequestStatus ?? null;
      this.form = {
        ...res,
        projectTimes: this.projects.map(p => res.projectTimes?.find(x => x.projectName === p.name) ?? { projectName: p.name, percentSpent: 0 }),
        tasks: res.tasks ?? [],
      };
      this.syncTaskProjectsFromTasks();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
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
}
