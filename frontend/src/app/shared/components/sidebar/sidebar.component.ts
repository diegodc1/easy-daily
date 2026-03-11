import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { DailyService } from '../../../core/services/daily.service';
import { catchError, of } from 'rxjs';
import { notifyDailyDone, notifyDailyNotDone } from '../../../core/electron-helper';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  mobileMenuOpen = false;
  appVersion = '';
  updateAvailable = false;
  updateInProgress = false;
  updateActionInProgress = false;
  updateStatusMessage = '';

  constructor(public auth: AuthService, public theme: ThemeService, private dailyService: DailyService) {}

  ngOnInit(): void {
    this.syncTodayDailyStatusForElectron();
    this.refreshUpdateAvailability();

    const getVersion = window.dailyElectron?.getAppVersion;
    if (getVersion) {
      getVersion()
        .then(version => {
          this.appVersion = version || '';
        })
        .catch(() => {
          this.loadWebVersion();
        });
      return;
    }

    this.loadWebVersion();
  }

  refreshUpdateAvailability(): void {
    const checkUpdateAvailability = window.dailyElectron?.checkUpdateAvailability;
    if (!checkUpdateAvailability) return;

    checkUpdateAvailability()
      .then(info => {
        this.updateAvailable = !!info?.updateAvailable;
        this.updateInProgress = !!info?.updateInProgress;
      })
      .catch(() => {
        this.updateAvailable = false;
        this.updateInProgress = false;
      });
  }

  triggerManualUpdate(): void {
    if (this.updateActionInProgress) return;
    const startManualUpdate = window.dailyElectron?.startManualUpdate;
    if (!startManualUpdate) return;

    this.updateActionInProgress = true;
    this.updateStatusMessage = '';

    startManualUpdate()
      .then(result => {
        if (result?.started) {
          this.updateStatusMessage = 'Atualizacao iniciada. O app sera reiniciado apos concluir.';
          this.updateInProgress = true;
          return;
        }
        this.updateStatusMessage = 'Nenhuma atualizacao nova disponivel.';
        this.refreshUpdateAvailability();
      })
      .catch(() => {
        this.updateStatusMessage = 'Falha ao iniciar atualizacao.';
      })
      .finally(() => {
        this.updateActionInProgress = false;
      });
  }

  private syncTodayDailyStatusForElectron(): void {
    if (!window.dailyElectron) return;

    const today = this.getLocalDateKey();
    this.dailyService.getByDate(today).pipe(catchError(() => of(null))).subscribe(daily => {
      if (daily) {
        notifyDailyDone();
        return;
      }
      notifyDailyNotDone();
    });
  }

  private getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    if (this.isMobileViewport()) {
      this.mobileMenuOpen = false;
    }
  }

  logout(): void {
    this.closeMobileMenu();
    this.auth.logout();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isMobileViewport()) {
      this.mobileMenuOpen = false;
    }
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  }

  private loadWebVersion(): void {
    fetch('assets/version.json', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        this.appVersion = typeof data?.version === 'string' ? data.version : '';
      })
      .catch(() => {
        this.appVersion = '';
      });
  }
}
