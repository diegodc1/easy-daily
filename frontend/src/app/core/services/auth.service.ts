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

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('daily_user');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as LoginResponse;
      if (this.isTokenExpired(localStorage.getItem('daily_token'))) {
        this.clearSession();
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
      this.clearSession();
      return null;
    }
    return token;
  }

  getUser():     LoginResponse | null { return this.user$.value; }
  isAdmin():     boolean { return this.user$.value?.role === 'ADMIN'; }
  isLoggedIn():  boolean { return !!this.user$.value && !!this.getToken(); }

  private clearSession() {
    localStorage.removeItem('daily_user');
    localStorage.removeItem('daily_token');
    this.user$.next(null);
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
