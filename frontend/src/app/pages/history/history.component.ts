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
}
