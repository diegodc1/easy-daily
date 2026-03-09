import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { AppProject, ProjectRequest, DEFAULT_PROJECT_COLORS } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit {
  projects: AppProject[] = [];
  showModal = false;
  editing: AppProject | null = null;
  saving = false;
  formError = '';

  visibleProjectIds: number[] = [];
  prefLoading = false;
  prefSaving = false;
  prefError = '';

  form: ProjectRequest = this.emptyForm();
  readonly palette = DEFAULT_PROJECT_COLORS;

  constructor(private svc: DailyService, public auth: AuthService) {}

  ngOnInit() {
    this.load();
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  load() {
    const obs = this.isAdmin ? this.svc.getAdminProjects() : this.svc.getActiveProjects();
    obs.pipe(catchError(() => of([]))).subscribe(p => {
      this.projects = p;
      this.loadPreferences();
    });
  }

  loadPreferences() {
    this.prefLoading = true;
    this.svc.getDailyProjectPreferences()
      .pipe(catchError(() => of({ projectIds: this.projects.filter(p => p.active).map(p => p.id) })))
      .subscribe(pref => {
        this.prefLoading = false;
        this.applyVisibleIds(pref.projectIds ?? []);
      });
  }

  openCreate() {
    if (!this.isAdmin) return;
    this.editing = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.showModal = true;
  }

  openEdit(p: AppProject) {
    if (!this.isAdmin) return;
    this.editing = p;
    this.form = { name: p.name, color: p.color, sortOrder: p.sortOrder };
    this.formError = '';
    this.showModal = true;
  }

  save() {
    if (!this.isAdmin) return;
    if (!this.form.name.trim()) {
      this.formError = 'Nome e obrigatorio.';
      return;
    }
    this.saving = true;
    this.formError = '';

    const obs = this.editing
      ? this.svc.updateProject(this.editing.id, this.form)
      : this.svc.createProject(this.form);

    obs.pipe(catchError(() => {
      this.formError = 'Erro ao salvar.';
      return of(null);
    })).subscribe(res => {
      this.saving = false;
      if (res) {
        this.showModal = false;
        this.load();
      }
    });
  }

  toggle(p: AppProject) {
    if (!this.isAdmin) return;
    this.svc.toggleProject(p.id).subscribe(() => this.load());
  }

  isProjectVisible(projectId: number): boolean {
    return this.visibleProjectIds.includes(projectId);
  }

  canToggleProjectVisibility(p: AppProject): boolean {
    return p.active && !this.prefSaving && !this.prefLoading;
  }

  onProjectVisibilityChange(projectId: number, checked: boolean) {
    this.prefError = '';
    const nextIds = checked
      ? [...this.visibleProjectIds, projectId]
      : this.visibleProjectIds.filter(id => id !== projectId);

    const activeIds = this.projects.filter(p => p.active).map(p => p.id);
    const normalized = nextIds
      .filter(id => activeIds.includes(id))
      .filter((id, index, arr) => arr.indexOf(id) === index);

    if (normalized.length === 0) {
      this.prefError = 'Selecione ao menos um projeto para exibir nas listas.';
      return;
    }

    this.visibleProjectIds = normalized;
    this.prefSaving = true;

    this.svc.saveDailyProjectPreferences(this.visibleProjectIds)
      .pipe(catchError(() => {
        this.prefSaving = false;
        this.prefError = 'Nao foi possivel salvar suas preferencias.';
        return of(null);
      }))
      .subscribe(res => {
        this.prefSaving = false;
        if (!res) return;
        this.applyVisibleIds(res.projectIds ?? this.visibleProjectIds);
      });
  }

  private applyVisibleIds(projectIds: number[]) {
    const activeIds = this.projects.filter(p => p.active).map(p => p.id);
    const filtered = (projectIds ?? [])
      .filter(id => activeIds.includes(id))
      .filter((id, index, arr) => arr.indexOf(id) === index);
    this.visibleProjectIds = filtered.length > 0 ? filtered : activeIds;
  }

  pickColor(c: string) {
    this.form.color = c;
  }

  emptyForm(): ProjectRequest {
    return { name: '', color: DEFAULT_PROJECT_COLORS[0], sortOrder: 0 };
  }
}
