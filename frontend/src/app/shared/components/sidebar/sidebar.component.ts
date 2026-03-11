import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  mobileMenuOpen = false;
  appVersion = environment.appVersion || '';

  constructor(public auth: AuthService, public theme: ThemeService) {}

  ngOnInit(): void {
    const getVersion = window.dailyElectron?.getAppVersion;
    if (!getVersion) return;
    getVersion()
      .then(version => {
        this.appVersion = version || '';
      })
      .catch(() => {
        this.appVersion = '';
      });
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
}
