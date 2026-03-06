import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { DailyByDate, AppProject, PROTOCOL_TYPES, PROTOCOL_COLORS, PROTOCOL_LABELS } from '../../core/models/models';
import { catchError, of, forkJoin } from 'rxjs';

interface ProjectStat { name: string; color: string; totalPct: number; avgPct: number; }
interface BlockerInfo  { member: string; date: string; description: string; }
interface ProtocolStat { type: string; label: string; color: string; total: number; }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('pieCanvas')   pieCanvas!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('protoCanvas') protoCanvas!: ElementRef<HTMLCanvasElement>;

  // Default: yesterday only
  private yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
  })();

  filter = { start: this.yesterday, end: this.yesterday };

  loading       = false;
  groups:       DailyByDate[] = [];
  projects:     AppProject[]  = [];
  projectStats: ProjectStat[] = [];
  protocolStats:ProtocolStat[]= [];
  blockers:     BlockerInfo[] = [];

  totalDailies     = 0;
  totalProtocols   = 0;
  totalBlockers    = 0;
  uniqueDays       = 0;
  avgParticipation = 0;

  readonly PROTOCOL_LABELS = PROTOCOL_LABELS;

  constructor(private svc: DailyService) {}
  ngOnInit()        { this.load(); }
  ngAfterViewInit() { if (this.groups.length) this.drawCharts(); }

  load() {
    this.loading = true;
    forkJoin({
      groups:   this.svc.getAllGrouped(this.filter.start, this.filter.end).pipe(catchError(() => of([]))),
      projects: this.svc.getAdminProjects().pipe(catchError(() => of([]))),
    }).subscribe(({ groups, projects }) => {
      this.groups = groups; this.projects = projects;
      this.compute();
      this.loading = false;
      setTimeout(() => this.drawCharts(), 60);
    });
  }

  private compute() {
    const all = this.groups.flatMap(g => g.dailies);
    this.totalDailies    = all.length;
    this.totalProtocols  = all.reduce((s, d) => s + (d.totalProtocols ?? 0), 0);
    this.totalBlockers   = all.filter(d => d.hasBlocker).length;
    this.uniqueDays      = this.groups.length;
    this.avgParticipation = this.uniqueDays ? Math.round(this.totalDailies / this.uniqueDays) : 0;

    this.projectStats = this.projects.map(p => {
      const rows = all.flatMap(d => d.projectTimes?.filter(pt => pt.projectName === p.name) ?? []);
      const total = rows.reduce((s, r) => s + (+r.percentSpent || 0), 0);
      return { name: p.name, color: p.color, totalPct: total, avgPct: rows.length ? Math.round(total / rows.length) : 0 };
    });

    this.protocolStats = PROTOCOL_TYPES.map(t => ({
      type:  t,
      label: PROTOCOL_LABELS[t],
      color: PROTOCOL_COLORS[t],
      total: all.reduce((s, d) => s + ((d as any)['protocol' + t] || 0), 0),
    }));

    this.blockers = [];
    for (const g of this.groups)
      for (const d of g.dailies)
        if (d.hasBlocker) this.blockers.push({ member: d.user?.fullName ?? '—', date: g.date, description: d.blockers || '—' });
  }

  drawCharts() { this.drawPie(); this.drawProto(); }

  private drawPie() {
    const canvas = this.pieCanvas?.nativeElement; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const total = this.projectStats.reduce((s, p) => s + p.totalPct, 0);
    if (total === 0) { this.emptyChart(ctx, W, H, 'Sem dados'); return; }
    const cx = W / 2, cy = H / 2, r = Math.min(cx, cy) - 20;
    let angle = -Math.PI / 2;
    for (const p of this.projectStats) {
      if (!p.totalPct) continue;
      const slice = (p.totalPct / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
      ctx.fillStyle = p.color; ctx.fill();
      const mid = angle + slice / 2, pct = Math.round((p.totalPct / total) * 100);
      if (pct >= 5) {
        ctx.fillStyle = '#000'; ctx.font = 'bold 12px DM Sans'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', cx + r * .65 * Math.cos(mid), cy + r * .65 * Math.sin(mid));
      }
      angle += slice;
    }
    ctx.beginPath(); ctx.arc(cx, cy, r * .45, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#101318';
    ctx.fill();
  }

  private drawProto() {
    const canvas = this.protoCanvas?.nativeElement; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...this.protocolStats.map(p => p.total), 1);
    const pad = { t: 20, r: 20, b: 50, l: 40 };
    const chartW = W - pad.l - pad.r, chartH = H - pad.t - pad.b;
    const gap = chartW / this.protocolStats.length, bw = gap * 0.5;

    // grid lines
    ctx.strokeStyle = 'rgba(128,128,128,.15)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      const val = Math.round(max - (max / 4) * i);
      ctx.fillStyle = 'rgba(128,128,128,.6)'; ctx.font = '10px DM Sans'; ctx.textAlign = 'right';
      ctx.fillText(String(val), pad.l - 4, y + 4);
    }

    this.protocolStats.forEach((p, i) => {
      const x = pad.l + gap * i + (gap - bw) / 2;
      const bh = max > 0 ? (p.total / max) * chartH : 0;
      const y = pad.t + chartH - bh;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      (ctx as any).roundRect?.(x, y, bw, Math.max(bh, 2), [4, 4, 0, 0]) ?? ctx.rect(x, y, bw, Math.max(bh, 2));
      ctx.fill();
      ctx.shadowBlur = 0;
      // value on bar
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px DM Sans'; ctx.textAlign = 'center';
      if (bh > 18) ctx.fillText(String(p.total), x + bw / 2, y + 14);
      // type label
      ctx.fillStyle = p.color; ctx.font = 'bold 13px Space Mono, monospace';
      ctx.fillText(p.type, x + bw / 2, pad.t + chartH + 18);
    });
  }

  private emptyChart(ctx: CanvasRenderingContext2D, W: number, H: number, msg: string) {
    ctx.fillStyle = 'rgba(128,128,128,.4)'; ctx.font = '14px DM Sans';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, W / 2, H / 2);
  }

  formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  maxPct() { return Math.max(...this.projectStats.map(p => p.totalPct), 1); }
}
