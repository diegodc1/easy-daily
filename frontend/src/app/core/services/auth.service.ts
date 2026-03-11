import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private user$ = new BehaviorSubject<LoginResponse | null>(null);
  currentUser$ = this.user$.asObservable();
  private redirectingToLogin = false;

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('daily_user');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as LoginResponse;
      if (this.isTokenExpired(localStorage.getItem('daily_token'))) {
        this.clearSessionAndRedirect();
        return;
      }
      this.user$.next(parsed);
    } catch {
      this.clearSession();
    }
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap(res => {
        localStorage.setItem('daily_user', JSON.stringify(res));
        localStorage.setItem('daily_token', res.token);
        this.user$.next(res);
      })
    );
  }

  logout() {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const token = localStorage.getItem('daily_token');
    if (this.isTokenExpired(token)) {
      this.clearSessionAndRedirect();
      return null;
    }
    return token;
  }

  getUser():     LoginResponse | null { return this.user$.value; }
  isAdmin():     boolean { return this.user$.value?.role === 'ADMIN'; }
  isLoggedIn():  boolean {
    const token = localStorage.getItem('daily_token');
    const hasUser = !!this.user$.value;
    if (!hasUser || !token) return false;
    if (this.isTokenExpired(token)) {
      this.clearSessionAndRedirect();
      return false;
    }
    return true;
  }

  private clearSession() {
    localStorage.removeItem('daily_user');
    localStorage.removeItem('daily_token');
    this.user$.next(null);
  }

  private clearSessionAndRedirect() {
    this.clearSession();
    if (this.redirectingToLogin) return;
    this.redirectingToLogin = true;
    this.router.navigate(['/login']).finally(() => {
      this.redirectingToLogin = false;
    });
  }

  private isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
      const payload = token.split('.')[1];
      if (!payload) return true;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(padded));
      const exp = typeof decoded?.exp === 'number' ? decoded.exp : null;
      if (!exp) return true;
      return Date.now() >= exp * 1000;
    } catch {
      return true;
    }
  }
}
