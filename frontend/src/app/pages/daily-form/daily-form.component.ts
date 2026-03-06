import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { Daily, ProjectTime, AppProject, PROTOCOL_TYPES, PROTOCOL_COLORS, PROTOCOL_LABELS } from '../../core/models/models';
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

  readonly protocolTypes = PROTOCOL_TYPES;
  readonly protocolColors = PROTOCOL_COLORS;
  readonly protocolLabels = PROTOCOL_LABELS;

  constructor(private svc: DailyService) {}

  ngOnInit() {
    this.svc.getActiveProjects().pipe(catchError(() => of([]))).subscribe(p => {
      this.projects = p;
      this.loadForDate();
    });
  }

  emptyForm(): Daily {
    return {
      dailyDate: this.selectedDate,
      doneYesterday: '', doingToday: '', blockers: '',
      hasBlocker: false,
      protocolFA: 0, protocolIMP: 0, protocolDE: 0, protocolDI: 0, protocolCO: 0,
      projectTimes: this.projects.map(p => ({ projectName: p.name, percentSpent: 0 })),
    };
  }

  loadForDate() {
    this.form = {
      ...this.emptyForm(),
      dailyDate: this.selectedDate,
      projectTimes: this.projects.map(p => ({ projectName: p.name, percentSpent: 0 })),
    };
    this.isExistingDaily = false;
    this.canEditCurrentDaily = true;
    this.editRequestStatus = null;
    this.requestError = '';
    this.requestSuccess = '';

    this.svc.getByDate(this.selectedDate).pipe(catchError(() => of(null))).subscribe(d => {
      if (!d) return;
      this.isExistingDaily = true;
      this.canEditCurrentDaily = d.canEdit ?? false;
      this.editRequestStatus = d.editRequestStatus ?? null;

      this.form = {
        ...d,
        projectTimes: this.projects.map(p => d.projectTimes?.find(x => x.projectName === p.name) ?? { projectName: p.name, percentSpent: 0 }),
      };
    });
  }

  onDateChange() { this.loadForDate(); }

  get isEditLocked(): boolean {
    return this.isExistingDaily && !this.canEditCurrentDaily;
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

  // Access protocol field by type key
  getProtocol(type: string): number {
    return (this.form as any)['protocol' + type] ?? 0;
  }

  setProtocol(type: string, val: number) {
    (this.form as any)['protocol' + type] = val < 0 ? 0 : val;
  }

  totalProtocols(): number {
    return ['FA', 'IMP', 'DE', 'DI', 'CO'].reduce((s, t) => s + (this.getProtocol(t) || 0), 0);
  }

  totalPct(): number { return this.form.projectTimes.reduce((s, p) => s + (+p.percentSpent || 0), 0); }
  pctWarning(): boolean { return this.totalPct() > 100; }

  save() {
    if (this.isEditLocked) {
      this.saveError = 'Esta daily esta bloqueada para alteracao ate aprovacao do admin.';
      return;
    }
    if (this.pctWarning()) { this.saveError = 'A soma dos percentuais nao pode ultrapassar 100%.'; return; }
    this.loading = true;
    this.saveError = '';
    this.saveSuccess = false;
    this.svc.saveDaily({ ...this.form, dailyDate: this.selectedDate }).pipe(
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
      };
      this.saveSuccess = true;
      setTimeout(() => this.saveSuccess = false, 3500);
    });
  }

  barWidth(p: ProjectTime): string { return Math.min(+p.percentSpent || 0, 100) + '%'; }
  colorOf(name: string): string { return this.projects.find(p => p.name === name)?.color ?? '#888'; }
  protocolColor(type: string): string { return (PROTOCOL_COLORS as any)[type] ?? '#888'; }
}
