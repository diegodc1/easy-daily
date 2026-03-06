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
    if (stored) this.user$.next(JSON.parse(stored));
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
    localStorage.removeItem('daily_user');
    localStorage.removeItem('daily_token');
    this.user$.next(null);
    this.router.navigate(['/login']);
  }

  getToken():    string | null  { return localStorage.getItem('daily_token'); }
  getUser():     LoginResponse | null { return this.user$.value; }
  isAdmin():     boolean { return this.user$.value?.role === 'ADMIN'; }
  isLoggedIn():  boolean { return !!this.user$.value; }
}
