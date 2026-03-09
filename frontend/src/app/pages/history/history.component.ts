import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyService } from '../../core/services/daily.service';
import { Daily } from '../../core/models/models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
})
export class HistoryComponent implements OnInit {
  history: Daily[] = [];
  loading = true;

  constructor(private svc: DailyService) {}
  ngOnInit() {
    this.svc.getHistory().pipe(catchError(() => of([]))).subscribe(h => { this.history = h; this.loading = false; });
  }
  formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
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
