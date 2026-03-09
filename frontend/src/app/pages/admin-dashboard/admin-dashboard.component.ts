import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { DailyByDate, AppProject, User, PROTOCOL_TYPES, PROTOCOL_COLORS, PROTOCOL_LABELS } from '../../core/models/models';
import { catchError, of, forkJoin } from 'rxjs';

interface ProjectStat { name: string; color: string; totalPct: number; avgPct: number; }
interface BlockerInfo { member: string; date: string; description: string; }
interface ProtocolStat { type: string; label: string; color: string; total: number; }
interface DaySummary { date: string; dailies: number; protocols: number; blockers: number; }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('pieCanvas') pieCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('protoCanvas') protoCanvas!: ElementRef<HTMLCanvasElement>;

  private yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate());
    return d.toISOString().slice(0, 10);
  })();

  filter = { start: this.yesterday, end: this.yesterday };

  loading = false;
  groups: DailyByDate[] = [];
  users: User[] = [];
  selectedUserId = 'ALL';
  projects: AppProject[] = [];
  projectStats: ProjectStat[] = [];
  protocolStats: ProtocolStat[] = [];
  blockers: BlockerInfo[] = [];
  daySummaries: DaySummary[] = [];

  totalDailies = 0;
  totalProtocols = 0;
  totalBlockers = 0;
  uniqueDays = 0;
  avgParticipation = 0;

  readonly PROTOCOL_LABELS = PROTOCOL_LABELS;

  constructor(private svc: DailyService) {}

  ngOnInit() { this.load(); }

  ngAfterViewInit() {
    if (this.groups.length) this.drawCharts();
  }

  load() {
    this.loading = true;
    forkJoin({
      groups: this.svc.getAllGrouped(this.filter.start, this.filter.end).pipe(catchError(() => of([]))),
      projects: this.svc.getAdminProjects().pipe(catchError(() => of([]))),
      users: this.svc.getUsers().pipe(catchError(() => of([]))),
    }).subscribe(({ groups, projects, users }) => {
      this.groups = groups;
      this.projects = projects;
      this.users = users;
      this.compute();
      this.loading = false;
      setTimeout(() => this.drawCharts(), 60);
    });
  }

  onUserFilterChange() {
    this.compute();
    setTimeout(() => this.drawCharts(), 40);
  }

  private compute() {
    const all = this.groups.flatMap(g => this.filterDailies(g.dailies));

    this.totalDailies = all.length;
    this.totalProtocols = all.reduce((s, d) => s + (d.totalProtocols ?? 0), 0);
    this.totalBlockers = all.filter(d => d.hasBlocker).length;
    this.uniqueDays = this.groups.length;
    this.avgParticipation = this.uniqueDays ? Math.round(this.totalDailies / this.uniqueDays) : 0;

    this.projectStats = this.projects.map(p => {
      const rows = all.flatMap(d => d.projectTimes?.filter((pt: any) => pt.projectName === p.name) ?? []);
      const total = rows.reduce((s, r) => s + (+r.percentSpent || 0), 0);
      return {
        name: p.name,
        color: p.color,
        totalPct: total,
        avgPct: rows.length ? Math.round(total / rows.length) : 0,
      };
    });

    this.protocolStats = PROTOCOL_TYPES.map(t => ({
      type: t,
      label: PROTOCOL_LABELS[t],
      color: PROTOCOL_COLORS[t],
      total: all.reduce((s, d) => s + ((d as any)['protocol' + t] || 0), 0),
    }));

    this.daySummaries = this.groups.map(g => {
      const dailies = this.filterDailies(g.dailies);
      return {
        date: g.date,
        dailies: dailies.length,
        protocols: dailies.reduce((s, d) => s + (d.totalProtocols ?? 0), 0),
        blockers: dailies.filter(d => d.hasBlocker).length,
      };
    });

    this.blockers = [];
    for (const g of this.groups) {
      for (const d of this.filterDailies(g.dailies)) {
        if (d.hasBlocker) {
          this.blockers.push({
            member: d.user?.fullName ?? '-',
            date: g.date,
            description: d.blockers || '-',
          });
        }
      }
    }
  }

  drawCharts() {
    this.drawPie();
    this.drawProto();
  }

  private drawPie() {
    const canvas = this.pieCanvas?.nativeElement;
    if (!canvas) return;
    this.fitCanvasToContainer(canvas, 240);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = canvas.clientWidth || 240;
    const cssH = canvas.clientHeight || 240;

    ctx.clearRect(0, 0, cssW, cssH);

    const total = this.projectStats.reduce((s, p) => s + p.totalPct, 0);
    if (total === 0) {
      this.emptyChart(ctx, cssW, cssH, 'Sem dados');
      return;
    }

    const cx = cssW / 2;
    const cy = cssH / 2;
    const r = Math.min(cx, cy) - 16;
    let angle = -Math.PI / 2;

    for (const p of this.projectStats) {
      if (!p.totalPct) continue;
      const slice = (p.totalPct / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();

      const mid = angle + slice / 2;
      const pct = Math.round((p.totalPct / total) * 100);
      if (pct >= 6) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px DM Sans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', cx + r * 0.65 * Math.cos(mid), cy + r * 0.65 * Math.sin(mid));
      }
      angle += slice;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#101318';
    ctx.fill();
  }

  private drawProto() {
    const canvas = this.protoCanvas?.nativeElement;
    if (!canvas) return;
    this.fitCanvasToContainer(canvas, 260);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = canvas.clientWidth || 500;
    const cssH = canvas.clientHeight || 260;
    ctx.clearRect(0, 0, cssW, cssH);

    const max = Math.max(...this.protocolStats.map(p => p.total), 1);
    const pad = { t: 18, r: 20, b: 50, l: 38 };
    const chartW = cssW - pad.l - pad.r;
    const chartH = cssH - pad.t - pad.b;
    const gap = chartW / this.protocolStats.length;
    const bw = gap * 0.56;

    ctx.strokeStyle = 'rgba(128,128,128,.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(cssW - pad.r, y);
      ctx.stroke();
      const val = Math.round(max - (max / 4) * i);
      ctx.fillStyle = 'rgba(128,128,128,.6)';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), pad.l - 4, y + 4);
    }

    this.protocolStats.forEach((p, i) => {
      const x = pad.l + gap * i + (gap - bw) / 2;
      const bh = max > 0 ? (p.total / max) * chartH : 0;
      const y = pad.t + chartH - bh;

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      if ((ctx as any).roundRect) {
        ctx.beginPath();
        (ctx as any).roundRect(x, y, bw, Math.max(bh, 2), [5, 5, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, bw, Math.max(bh, 2));
      }
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px DM Sans';
      ctx.textAlign = 'center';
      if (bh > 18) ctx.fillText(String(p.total), x + bw / 2, y + 14);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px Space Mono, monospace';
      ctx.fillText(p.type, x + bw / 2, pad.t + chartH + 18);
    });
  }

  private fitCanvasToContainer(canvas: HTMLCanvasElement, minHeight: number) {
    const parent = canvas.parentElement;
    const cssWidth = Math.max(parent?.clientWidth ?? canvas.clientWidth ?? 300, 220);
    const cssHeight = Math.max(canvas.clientHeight || minHeight, minHeight);
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private emptyChart(ctx: CanvasRenderingContext2D, w: number, h: number, msg: string) {
    ctx.fillStyle = 'rgba(128,128,128,.4)';
    ctx.font = '14px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2);
  }

  private filterDailies(dailies: any[]) {
    if (this.selectedUserId === 'ALL') return dailies;
    const id = Number(this.selectedUserId);
    return dailies.filter(d => d.user?.id === id);
  }

  formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  maxDailyProtocols() {
    return Math.max(...this.daySummaries.map(d => d.protocols), 1);
  }
}
