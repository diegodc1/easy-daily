import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Daily, DailyByDate, User, UserRequest } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DailyService {
  constructor(private http: HttpClient) {}

  saveDaily(daily: Daily): Observable<Daily> {
    return this.http.post<Daily>(`${environment.apiUrl}/daily`, daily);
  }

  getToday(): Observable<Daily> {
    return this.http.get<Daily>(`${environment.apiUrl}/daily/today`);
  }

  getByDate(date: string): Observable<Daily> {
    return this.http.get<Daily>(`${environment.apiUrl}/daily/date/${date}`);
  }

  getHistory(): Observable<Daily[]> {
    return this.http.get<Daily[]>(`${environment.apiUrl}/daily/history`);
  }

  // Admin
  getAllGrouped(start?: string, end?: string): Observable<DailyByDate[]> {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<DailyByDate[]>(`${environment.apiUrl}/admin/dailies`, { params });
  }

  exportCsv(start?: string, end?: string): Observable<Blob> {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get(`${environment.apiUrl}/admin/export/csv`, {
      params, responseType: 'blob'
    });
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/admin/users`);
  }

  createUser(user: UserRequest): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/admin/users`, user);
  }

  updateUser(id: number, user: Partial<UserRequest>): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/admin/users/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/users/${id}`);
  }
}
