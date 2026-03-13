import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  router.navigate(['/daily']);
  return false;
};

export const participantGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.getUser()?.role !== 'SISTEMA') return true;
  router.navigate(['/dashboard']);
  return false;
};

export type PendingChangesComponent = {
  confirmDiscardChanges: () => boolean | Promise<boolean>;
};

export const pendingChangesGuard: CanDeactivateFn<PendingChangesComponent> = (component) => {
  if (!component || typeof component.confirmDiscardChanges !== 'function') return true;
  return component.confirmDiscardChanges();
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError((error) => {
      const isUnauthorized = error?.status === 401;
      const isLoginRequest = req.url.includes('/auth/login');
      if (isUnauthorized && !isLoginRequest) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};
