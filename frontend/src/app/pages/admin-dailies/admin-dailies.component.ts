import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { DailyByDate, Daily, PendingResponse, DailyEditRequest } from '../../core/models/models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-dailies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dailies.component.html',
})
export class AdminDailiesComponent implements OnInit {
  filter = {
    start: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  };

  groups: DailyByDate[] = [];
  pending: PendingResponse | null = null;
  pendingEditRequests: DailyEditRequest[] = [];
  loading = false;
  loadingRequests = false;
  exporting = false;
  requestActionLoadingId: number | null = null;
  requestActionError = '';
  expandedDates = new Set<string>();

  constructor(private svc: DailyService) {}

  ngOnInit() {
    this.load();
    this.loadPending();
    this.loadEditRequests();
  }

  load() {
    this.loading = true;
    this.svc.getAllGrouped(this.filter.start, this.filter.end)
      .pipe(catchError(() => of([])))
      .subscribe(d => {
        this.groups = d;
        this.loading = false;
        const today = new Date().toISOString().slice(0, 10);
        if (d.some(g => g.date === today)) this.expandedDates.add(today);
      });
  }

  loadPending() {
    const today = new Date().toISOString().slice(0, 10);
    this.svc.getPending(today).pipe(catchError(() => of(null))).subscribe(p => this.pending = p);
  }

  loadEditRequests() {
    this.loadingRequests = true;
    this.requestActionError = '';
    this.svc.getEditRequests('PENDING').pipe(catchError(() => of([]))).subscribe(reqs => {
      this.pendingEditRequests = reqs;
      this.loadingRequests = false;
    });
  }

  approveRequest(req: DailyEditRequest) {
    this.requestActionLoadingId = req.id;
    this.requestActionError = '';
    this.svc.approveEditRequest(req.id).pipe(catchError(() => of(null))).subscribe(res => {
      this.requestActionLoadingId = null;
      if (!res) {
        this.requestActionError = 'Nao foi possivel aprovar a solicitacao.';
        return;
      }
      this.pendingEditRequests = this.pendingEditRequests.filter(r => r.id !== req.id);
    });
  }

  rejectRequest(req: DailyEditRequest) {
    this.requestActionLoadingId = req.id;
    this.requestActionError = '';
    this.svc.rejectEditRequest(req.id).pipe(catchError(() => of(null))).subscribe(res => {
      this.requestActionLoadingId = null;
      if (!res) {
        this.requestActionError = 'Nao foi possivel recusar a solicitacao.';
        return;
      }
      this.pendingEditRequests = this.pendingEditRequests.filter(r => r.id !== req.id);
    });
  }

  toggleExpand(date: string) {
    this.expandedDates.has(date) ? this.expandedDates.delete(date) : this.expandedDates.add(date);
  }

  isExpanded(date: string) {
    return this.expandedDates.has(date);
  }

  exportCsv() {
    this.exporting = true;
    this.svc.exportCsv(this.filter.start, this.filter.end).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dailies_${this.filter.start}_${this.filter.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.exporting = false;
    });
  }

  getProjectColor(daily: Daily, projectName: string): string {
    return '#888';
  }

  formatDate(d: string) {
    const date = new Date(d + 'T12:00:00');
    const isToday = d === new Date().toISOString().slice(0, 10);
    const base = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return isToday ? `${base} - Hoje` : base;
  }

  getInitials(name?: string) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  parseProjectTasks(text: string | null | undefined): { projectName: string; description: string }[] {
    const raw = (text ?? '').trim();
    if (!raw) return [];

    return raw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^- \[(.+?)\]\s+(.+)$/);
        if (!match) return null;
        return { projectName: match[1].trim(), description: match[2].trim() };
      })
      .filter((t): t is { projectName: string; description: string } => !!t && !!t.projectName && !!t.description);
  }
}
