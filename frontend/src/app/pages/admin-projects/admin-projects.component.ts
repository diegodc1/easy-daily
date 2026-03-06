import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { AppProject, ProjectRequest, DEFAULT_PROJECT_COLORS } from '../../core/models/models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit {
  projects:    AppProject[] = [];
  showModal    = false;
  editing:     AppProject | null = null;
  saving       = false;
  formError    = '';

  form: ProjectRequest = this.emptyForm();
  readonly palette = DEFAULT_PROJECT_COLORS;

  constructor(private svc: DailyService) {}
  ngOnInit() { this.load(); }

  load() {
    this.svc.getAdminProjects().pipe(catchError(() => of([]))).subscribe(p => this.projects = p);
  }

  openCreate() {
    this.editing = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.showModal = true;
  }

  openEdit(p: AppProject) {
    this.editing = p;
    this.form = { name: p.name, color: p.color, sortOrder: p.sortOrder };
    this.formError = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.name.trim()) { this.formError = 'Nome é obrigatório.'; return; }
    this.saving = true; this.formError = '';
    const obs = this.editing
      ? this.svc.updateProject(this.editing.id, this.form)
      : this.svc.createProject(this.form);
    obs.pipe(catchError(err => { this.formError = 'Erro ao salvar.'; return of(null); }))
      .subscribe(res => { this.saving = false; if (res) { this.showModal = false; this.load(); } });
  }

  toggle(p: AppProject) {
    this.svc.toggleProject(p.id).subscribe(() => this.load());
  }

  pickColor(c: string) { this.form.color = c; }
  emptyForm(): ProjectRequest { return { name: '', color: DEFAULT_PROJECT_COLORS[0], sortOrder: 0 }; }
}
