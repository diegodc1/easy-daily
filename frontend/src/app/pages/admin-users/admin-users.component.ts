import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyService } from '../../core/services/daily.service';
import { User, UserRequest } from '../../core/models/models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  users:       User[]  = [];
  showModal    = false;
  editingUser: User | null = null;
  saving       = false;
  formError    = '';

  form: UserRequest & { id?: number } = this.emptyForm();

  constructor(private svc: DailyService) {}
  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.svc.getUsers().pipe(catchError(() => of([]))).subscribe(u => this.users = u);
  }

  openCreate() {
    this.editingUser = null;
    this.form        = this.emptyForm();
    this.formError   = '';
    this.showModal   = true;
  }

  openEdit(u: User) {
    this.editingUser = u;
    this.form        = {
      username: u.username,
      password: '',
      fullName: u.fullName,
      email: u.email ?? '',
      bitrixId: u.bitrixId ?? '',
      role: u.role,
    };
    this.formError   = '';
    this.showModal   = true;
  }

  save() {
    this.saving = true; this.formError = '';
    const obs = this.editingUser
      ? this.svc.updateUser(this.editingUser.id, this.form)
      : this.svc.createUser(this.form);
    obs.pipe(catchError(err => {
      this.formError = err.status === 400 ? 'Usuário já existe.' : 'Erro ao salvar.';
      return of(null);
    })).subscribe(res => {
      this.saving = false;
      if (res) { this.showModal = false; this.loadUsers(); }
    });
  }

  deactivate(u: User) {
    if (!confirm(`Desativar ${u.fullName}?`)) return;
    this.svc.deactivateUser(u.id).subscribe(() => this.loadUsers());
  }

  getInitials(n: string) {
    return n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }

  emptyForm(): UserRequest {
    return { username: '', password: '', fullName: '', email: '', bitrixId: '', role: 'MEMBER' };
  }
}
