import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import {
  ProtocolCounts,
  Daily,
  DailyByDate,
  User,
  UserRequest,
  AppProject,
  ProjectRequest,
  PendingResponse,
  DailyEditRequest,
  UserProjectPreferences,
  PreDaily,
  GeneralNote,
} from '../models/models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DailyService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient, private auth: AuthService) {}

  private readNumber(source: any, keys: string[]): number | null {
    if (!source || typeof source !== 'object') return null;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        const val = Number(source[key]);
        return Number.isFinite(val) ? val : 0;
      }
    }
    return null;
  }

  private mapProtocolsResponse(res: any): ProtocolCounts | null {
    console.log(res)
    const candidates = [
      res,
      res?.data,
      res?.result,
      res?.resume,
      res?.protocols,
      Array.isArray(res) ? res[0] : null,
      Array.isArray(res?.data) ? res.data[0] : null,
    ].filter(Boolean);

    for (const item of candidates) {
      const fa = this.readNumber(item, ['FA', 'fa', 'protocolFA', 'protocol_fa', 'fa_count']);
      const imp = this.readNumber(item, ['IMP', 'imp', 'IM', 'im', 'protocolIMP', 'protocol_imp', 'imp_count']);
      const de = this.readNumber(item, ['DE', 'de', 'protocolDE', 'protocol_de', 'de_count']);
      const di = this.readNumber(item, ['DI', 'di', 'protocolDI', 'protocol_di', 'di_count']);
      const co = this.readNumber(item, ['CO', 'co', 'protocolCO', 'protocol_co', 'co_count']);

      if (fa !== null || imp !== null || de !== null || di !== null || co !== null) {
        return {
          FA: fa ?? 0,
          IMP: imp ?? 0,
          DE: de ?? 0,
          DI: di ?? 0,
          CO: co ?? 0,
        };
      }
    }

    return null;
  }

  // ── Member ────────────────────────────────────────────────────
  saveDaily(d: Partial<Daily>): Observable<Daily> {
    return this.http.post<Daily>(`${this.base}/daily`, d);
  }
  getByDate(date: string): Observable<Daily> {
    return this.http.get<Daily>(`${this.base}/daily/date/${date}`);
  }
  savePreDaily(d: Partial<PreDaily>): Observable<PreDaily> {
    return this.http.post<PreDaily>(`${this.base}/daily/pre-daily`, d);
  }
  getPreDaily(): Observable<PreDaily> {
    return this.http.get<PreDaily>(`${this.base}/daily/pre-daily`);
  }
  getPreDailyByDate(date: string): Observable<PreDaily> {
    return this.http.get<PreDaily>(`${this.base}/daily/pre-daily/date/${date}`);
  }
  deletePreDaily(): Observable<void> {
    return this.http.delete<void>(`${this.base}/daily/pre-daily`);
  }
  deletePreDailyByDate(date: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/daily/pre-daily/date/${date}`);
  }
  getGeneralNotes(): Observable<GeneralNote[]> {
    return this.http.get<GeneralNote[]>(`${this.base}/daily/notes`);
  }
  createGeneralNote(note: Partial<GeneralNote>): Observable<GeneralNote> {
    return this.http.post<GeneralNote>(`${this.base}/daily/notes`, note);
  }
  updateGeneralNote(id: number, note: Partial<GeneralNote>): Observable<GeneralNote> {
    return this.http.put<GeneralNote>(`${this.base}/daily/notes/${id}`, note);
  }
  setGeneralNoteFinished(id: number, finished: boolean): Observable<GeneralNote> {
    return this.http.patch<GeneralNote>(`${this.base}/daily/notes/${id}/finished`, { finished });
  }
  deleteGeneralNote(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/daily/notes/${id}`);
  }
  getTodayProtocols(): Observable<ProtocolCounts | null> {
    const bitrixId = this.auth.getUser()?.bitrixId?.trim();
    if (!bitrixId) return of(null);

    const url = `${environment.protocolsResumeBaseUrl}/${encodeURIComponent(bitrixId)}`;
    console.log(url)
    return this.http.get<any>(url).pipe(
      map(res => this.mapProtocolsResponse(res))
    );
  }
  getHistory(): Observable<Daily[]> {
    return this.http.get<Daily[]>(`${this.base}/daily/history`);
  }
  requestEditPermission(dailyDate: string, reason?: string): Observable<DailyEditRequest> {
    return this.http.post<DailyEditRequest>(`${this.base}/daily/edit-requests`, { dailyDate, reason });
  }
  getActiveProjects(): Observable<AppProject[]> {
    return this.http.get<AppProject[]>(`${this.base}/daily/projects`);
  }
  getDailyProjectPreferences(): Observable<UserProjectPreferences> {
    return this.http.get<UserProjectPreferences>(`${this.base}/daily/projects/preferences`);
  }
  saveDailyProjectPreferences(projectIds: number[]): Observable<UserProjectPreferences> {
    return this.http.put<UserProjectPreferences>(`${this.base}/daily/projects/preferences`, { projectIds });
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
  getEditRequests(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'): Observable<DailyEditRequest[]> {
    return this.http.get<DailyEditRequest[]>(`${this.base}/admin/edit-requests`, {
      params: new HttpParams().set('status', status),
    });
  }
  approveEditRequest(id: number, note?: string): Observable<DailyEditRequest> {
    return this.http.patch<DailyEditRequest>(`${this.base}/admin/edit-requests/${id}/approve`, { note });
  }
  rejectEditRequest(id: number, note?: string): Observable<DailyEditRequest> {
    return this.http.patch<DailyEditRequest>(`${this.base}/admin/edit-requests/${id}/reject`, { note });
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
