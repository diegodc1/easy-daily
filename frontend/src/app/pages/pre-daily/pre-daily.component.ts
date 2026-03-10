import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { DailyService } from '../../core/services/daily.service';
import { AppProject, PreDaily, PreDailyTask } from '../../core/models/models';

@Component({
  selector: 'app-pre-daily',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pre-daily.component.html',
})
export class PreDailyComponent implements OnInit {
  private readonly lastEventStorageKey = 'pre_daily_last_event';

  projects: AppProject[] = [];
  visibleProjectIds: number[] = [];
  selectedProject = '';
  projectBlocks: string[] = [];

  form: PreDaily = { dailyDate: new Date().toISOString().slice(0, 10), tasks: [] };

  loading = false;
  clearLoading = false;
  saveSuccess = false;
  successMessage = 'Pre-daily salva com sucesso.';
  saveError = '';
  showClearModal = false;
  showRemoveProjectModal = false;
  projectToRemove: string | null = null;
  lastEventText = '';

  constructor(private svc: DailyService) {}

  ngOnInit() {
    this.lastEventText = this.readStoredLastEventText();

    this.svc.getActiveProjects().pipe(catchError(() => of([]))).subscribe(p => {
      this.projects = p;
      this.svc.getDailyProjectPreferences().pipe(catchError(() => of({ projectIds: p.map(x => x.id) }))).subscribe(pref => {
        this.applyVisibleProjects(pref.projectIds ?? []);
        this.ensureSelectedProject();
        this.load();
      });
    });
  }

  get visibleProjects(): AppProject[] {
    const visibleSet = new Set(this.visibleProjectIds);
    return this.projects.filter(p => visibleSet.has(p.id));
  }

  get visibleProjectBlocks(): string[] {
    return this.projectBlocks.filter(name => this.isVisibleProjectName(name));
  }

  addProjectBlock() {
    if (!this.selectedProject) return;
    if (!this.projectBlocks.includes(this.selectedProject)) {
      this.projectBlocks.push(this.selectedProject);
    }
    if (this.getTasksByProject(this.selectedProject).length === 0) {
      this.addTask(this.selectedProject);
    }
  }

  removeProjectBlock(projectName: string) {
    this.projectToRemove = projectName;
    this.showRemoveProjectModal = true;
  }

  confirmRemoveProjectBlock() {
    if (!this.projectToRemove) return;
    const projectName = this.projectToRemove;
    this.projectBlocks = this.projectBlocks.filter(p => p !== projectName);
    this.form.tasks = (this.form.tasks ?? []).filter(t => t.projectName !== projectName);
    this.projectToRemove = null;
    this.showRemoveProjectModal = false;
  }

  cancelRemoveProjectBlock() {
    this.projectToRemove = null;
    this.showRemoveProjectModal = false;
  }

  getTasksByProject(projectName: string): PreDailyTask[] {
    return (this.form.tasks ?? []).filter(t => t.projectName === projectName);
  }

  addTask(projectName: string) {
    if (!projectName) return;
    if (!this.form.tasks) this.form.tasks = [];
    if (!this.projectBlocks.includes(projectName)) {
      this.projectBlocks.push(projectName);
    }
    this.form.tasks.push({ projectName, description: '' });
  }

  removeTask(task: PreDailyTask) {
    if (!this.form.tasks) return;
    this.form.tasks = this.form.tasks.filter(t => t !== task);
  }

  save() {
    const sanitizedTasks = (this.form.tasks ?? [])
      .filter(t => !!t.projectName && (t.description ?? '').trim().length > 0)
      .map(t => ({ projectName: t.projectName, description: t.description.trim() }));

    this.loading = true;
    this.saveSuccess = false;
    this.saveError = '';

    this.svc.savePreDaily({ tasks: sanitizedTasks }).pipe(
      catchError(() => {
        this.loading = false;
        this.saveError = 'Erro ao salvar pre-daily.';
        return of(null);
      })
    ).subscribe(res => {
      this.loading = false;
      if (!res) return;
      this.form = { ...res, tasks: res.tasks ?? [] };
      this.applyUpdateEvent(res.updatedAt ?? res.createdAt);
      this.syncProjectBlocksFromTasks();
      this.ensureSelectedProject();
      this.successMessage = 'Pre-daily salva com sucesso.';
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
  }

  openClearModal() {
    this.saveError = '';
    this.showClearModal = true;
  }

  closeClearModal() {
    if (this.clearLoading) return;
    this.showClearModal = false;
  }

  clearPreDaily() {
    if (this.clearLoading) return;
    this.clearLoading = true;
    this.saveError = '';
    this.svc.deletePreDaily().pipe(
      catchError(() => {
        this.clearLoading = false;
        this.saveError = 'Erro ao limpar pre-daily.';
        return of(null);
      })
    ).subscribe(() => {
      this.clearLoading = false;
      this.showClearModal = false;
      this.form = { dailyDate: new Date().toISOString().slice(0, 10), tasks: [] };
      this.projectBlocks = [];
      this.applyDeleteEvent(new Date().toISOString());
      this.ensureSelectedProject();
      this.successMessage = 'Pre-daily limpa com sucesso.';
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3500);
    });
  }

  private load() {
    this.form = { dailyDate: new Date().toISOString().slice(0, 10), tasks: [] };
    this.projectBlocks = [];
    this.saveError = '';

    this.svc.getPreDaily().pipe(catchError(() => of(null))).subscribe(d => {
      if (!d) return;
      this.applyUpdateEvent(d.updatedAt ?? d.createdAt);
      this.form = { ...d, tasks: d.tasks ?? [] };
      this.syncProjectBlocksFromTasks();
      this.ensureSelectedProject();
    });
  }

  private applyUpdateEvent(isoDate?: string) {
    if (!isoDate) return;
    const current = this.readStoredLastEvent();
    const next = { type: 'update' as const, at: isoDate };
    if (!current || this.toMillis(next.at) >= this.toMillis(current.at)) {
      this.storeLastEvent(next);
      this.lastEventText = this.buildLastEventText(next);
    }
  }

  private applyDeleteEvent(isoDate: string) {
    const evt = { type: 'delete' as const, at: isoDate };
    this.storeLastEvent(evt);
    this.lastEventText = this.buildLastEventText(evt);
  }

  private buildLastEventText(event: { type: 'update' | 'delete'; at: string }): string {
    const action = event.type === 'delete' ? 'Ultima exclusao' : 'Última atualização';
    return `${action}: ${this.formatDateTime(event.at)}`;
  }

  private formatDateTime(value: string): string {
    const parsed = value.includes('T') ? value : value.replace(' ', 'T');
    const date = new Date(parsed);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
  }

  private readStoredLastEventText(): string {
    const event = this.readStoredLastEvent();
    return event ? this.buildLastEventText(event) : '';
  }

  private readStoredLastEvent(): { type: 'update' | 'delete'; at: string } | null {
    try {
      const raw = localStorage.getItem(this.lastEventStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.type || !parsed?.at) return null;
      if (parsed.type !== 'update' && parsed.type !== 'delete') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private storeLastEvent(event: { type: 'update' | 'delete'; at: string }) {
    localStorage.setItem(this.lastEventStorageKey, JSON.stringify(event));
  }

  private toMillis(value: string): number {
    const parsed = value.includes('T') ? value : value.replace(' ', 'T');
    const time = new Date(parsed).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private syncProjectBlocksFromTasks() {
    const unique = new Set((this.form.tasks ?? []).map(t => t.projectName).filter(Boolean));
    this.projectBlocks = Array.from(unique);
  }

  private applyVisibleProjects(projectIds: number[]) {
    const activeIds = this.projects.map(p => p.id);
    const filtered = (projectIds ?? [])
      .filter(id => activeIds.includes(id))
      .filter((id, index, arr) => arr.indexOf(id) === index);
    this.visibleProjectIds = filtered.length > 0 ? filtered : activeIds;
  }

  private ensureSelectedProject() {
    const firstVisibleName = this.visibleProjects[0]?.name ?? '';
    if (!this.selectedProject || !this.isVisibleProjectName(this.selectedProject)) {
      this.selectedProject = firstVisibleName;
    }
  }

  private isVisibleProjectName(projectName: string): boolean {
    const p = this.projects.find(x => x.name === projectName);
    return !!p && this.visibleProjectIds.includes(p.id);
  }
}
