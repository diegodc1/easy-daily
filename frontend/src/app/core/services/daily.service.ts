import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Daily, DailyByDate, User, UserRequest, AppProject, ProjectRequest, PendingResponse } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DailyService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  // ── Member ────────────────────────────────────────────────────
  saveDaily(d: Partial<Daily>): Observable<Daily> {
    return this.http.post<Daily>(`${this.base}/daily`, d);
  }
  getByDate(date: string): Observable<Daily> {
    return this.http.get<Daily>(`${this.base}/daily/date/${date}`);
  }
  getHistory(): Observable<Daily[]> {
    return this.http.get<Daily[]>(`${this.base}/daily/history`);
  }
  getActiveProjects(): Observable<AppProject[]> {
    return this.http.get<AppProject[]>(`${this.base}/daily/projects`);
  }

  // ── Admin ─────────────────────────────────────────────────────
  getAllGrouped(start: string, end: string): Observable<DailyByDate[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<DailyByDate[]>(`${this.base}/admin/dailies`, { params });
  }
  getPending(date: string): Observable<PendingResponse> {
    return this.http.get<PendingResponse>(`${this.base}/admin/pending`, { params: new HttpParams().set('date', date) });
  }
  exportCsv(start: string, end: string): Observable<Blob> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get(`${this.base}/admin/export/csv`, { params, responseType: 'blob' });
  }

  // ── Project config ────────────────────────────────────────────
  getAdminProjects(): Observable<AppProject[]> {
    return this.http.get<AppProject[]>(`${this.base}/admin/projects`);
  }
  createProject(r: ProjectRequest): Observable<AppProject> {
    return this.http.post<AppProject>(`${this.base}/admin/projects`, r);
  }
  updateProject(id: number, r: ProjectRequest): Observable<AppProject> {
    return this.http.put<AppProject>(`${this.base}/admin/projects/${id}`, r);
  }
  toggleProject(id: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/admin/projects/${id}/toggle`, {});
  }

  // ── Users ─────────────────────────────────────────────────────
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/users`);
  }
  createUser(u: UserRequest): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/users`, u);
  }
  updateUser(id: number, u: Partial<UserRequest>): Observable<User> {
    return this.http.put<User>(`${this.base}/admin/users/${id}`, u);
  }
  deactivateUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/users/${id}`);
  }
}
