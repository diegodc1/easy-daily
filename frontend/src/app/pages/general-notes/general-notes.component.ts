import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { DailyService } from '../../core/services/daily.service';
import { AppProject, GeneralNote } from '../../core/models/models';

@Component({
  selector: 'app-general-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './general-notes.component.html',
})
export class GeneralNotesComponent implements OnInit {
  projects: AppProject[] = [];
  notes: GeneralNote[] = [];

  loading = false;
  saving = false;
  saveError = '';
  saveSuccess = false;

  filterProject = 'ALL';
  searchText = '';
  showFinished = true;

  newNote: GeneralNote = {projectName: '', protocol: '', title: '', noteText: ''};
  editingId: number | null = null;
  editDraft: GeneralNote = {projectName: '', protocol: '', title: '', noteText: ''};
  editSaving = false;
  showDeleteModal = false;
  deleteLoading = false;
  deleteTarget: GeneralNote | null = null;

  showNoteModal = false;
  selectedNote: GeneralNote | null = null;

  constructor(private svc: DailyService) {
  }

  ngOnInit(): void {
    this.svc.getActiveProjects().pipe(catchError(() => of([]))).subscribe(projects => {
      this.projects = projects;
    });
    this.loadNotes();
  }

  get filteredNotes(): GeneralNote[] {
    const term = this.searchText.trim().toLowerCase();
    return this.notes.filter(note => {
      if (!this.showFinished && !!note.finished) return false;
      const byProject = this.filterProject === 'ALL' || note.projectName === this.filterProject;
      if (!byProject) return false;
      if (!term) return true;
      const haystack = `${note.projectName} ${note.protocol ?? ''} ${note.title ?? ''} ${note.noteText}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  loadNotes() {
    this.loading = true;
    this.saveError = '';
    this.svc.getGeneralNotes().pipe(catchError(() => of([]))).subscribe(notes => {
      this.loading = false;
      this.notes = notes ?? [];
    });
  }

  addNote() {
    const payload = this.buildPayload(this.newNote);
    if (!payload) return;

    this.saving = true;
    this.saveError = '';
    this.svc.createGeneralNote(payload).pipe(catchError(() => of(null))).subscribe(created => {
      this.saving = false;
      if (!created) {
        this.saveError = 'Nao foi possivel salvar a anotacao.';
        return;
      }
      this.notes = [created, ...this.notes];
      this.newNote = {projectName: '', protocol: '', noteText: ''};
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3000);
    });
  }

  toggleFinished(note: GeneralNote) {
    if (!note.id) return;
    const next = !note.finished;
    this.saveError = '';
    this.svc.setGeneralNoteFinished(note.id, next).pipe(catchError(() => of(null))).subscribe(updated => {
      if (!updated) {
        this.saveError = 'Nao foi possivel atualizar o status da anotacao.';
        return;
      }
      this.notes = this.notes.map(n => (n.id === updated.id ? updated : n));
    });
  }

  startEdit(note: GeneralNote) {
    this.editingId = note.id ?? null;
    this.editDraft = {
      projectName: note.projectName === 'Geral' ? '' : note.projectName,
      protocol: note.protocol ?? '',
      title: note.title ?? '',
      noteText: note.noteText,
    };
    this.saveError = '';
  }

  cancelEdit() {
    if (this.editSaving) return;
    this.editingId = null;
    this.editDraft = {projectName: '', protocol: '', title: '', noteText: ''};
  }

  saveEdit(note: GeneralNote) {
    if (!note.id) return;
    const payload = this.buildPayload(this.editDraft);
    if (!payload) return;

    this.editSaving = true;
    this.saveError = '';
    this.svc.updateGeneralNote(note.id, payload).pipe(catchError(() => of(null))).subscribe(updated => {
      this.editSaving = false;
      if (!updated) {
        this.saveError = 'Nao foi possivel atualizar a anotacao.';
        return;
      }
      this.notes = this.notes.map(n => (n.id === updated.id ? updated : n));
      this.cancelEdit();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3000);
    });
  }

  deleteNote(note: GeneralNote) {
    if (!note.id || this.deleteLoading) return;
    this.deleteTarget = note;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    if (this.deleteLoading) return;
    this.showDeleteModal = false;
    this.deleteTarget = null;
  }

  confirmDeleteNote() {
    const note = this.deleteTarget;
    if (!note?.id || this.deleteLoading) return;

    this.deleteLoading = true;
    this.saveError = '';
    this.svc.deleteGeneralNote(note.id).pipe(catchError(err => {
      console.error('Delete error:', err);
      return of('ERROR');
    })).subscribe(res => {
      this.deleteLoading = false;
      if (res === 'ERROR') {
        this.saveError = 'Nao foi possivel excluir a anotacao.';
        return;
      }
      this.notes = this.notes.filter(n => n.id !== note.id);
      this.closeDeleteModal();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3000);
    });
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR');
  }

  private buildPayload(note: GeneralNote): {
    projectName: string;
    protocol?: string | null;
    title?: string | null;
    noteText: string
  } | null {
    const projectName = (note.projectName ?? '').trim();
    const noteText = (note.noteText ?? '').trim();
    const protocol = (note.protocol ?? '').trim();
    const title = (note.title ?? '').trim();

    if (!noteText) {
      this.saveError = 'Texto da anotacao e obrigatorio.';
      return null;
    }

    return {
      projectName: projectName || 'Geral',
      noteText,
      protocol: protocol || null,
      title: title || null,
    };
  }

  isNoteTextLarge(note: GeneralNote): boolean {
    return (note.noteText ?? '').length > 200;
  }

  openNoteModal(note: GeneralNote) {
    this.selectedNote = note;
    this.showNoteModal = true;
  }

  closeNoteModal() {
    this.showNoteModal = false;
    this.selectedNote = null;
  }
}
