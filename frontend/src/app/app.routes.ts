import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'daily', pathMatch: 'full' },
  { path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'daily', canActivate: [authGuard],
    loadComponent: () => import('./pages/daily-form/daily-form.component').then(m => m.DailyFormComponent) },
  { path: 'history', canActivate: [authGuard],
    loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent) },
  { path: 'dashboard', canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
  { path: 'admin/dailies', canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-dailies/admin-dailies.component').then(m => m.AdminDailiesComponent) },
  { path: 'admin/projects', canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-projects/admin-projects.component').then(m => m.AdminProjectsComponent) },
  { path: 'admin/users', canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-users/admin-users.component').then(m => m.AdminUsersComponent) },
  { path: '**', redirectTo: 'daily' },
];
