import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  mobileMenuOpen = false;
  appVersion = '';

  constructor(public auth: AuthService, public theme: ThemeService) {}

  ngOnInit(): void {
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
