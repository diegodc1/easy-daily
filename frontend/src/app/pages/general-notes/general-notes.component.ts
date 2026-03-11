import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { DailyService } from '../../core/services/daily.service';
import { AppProject, GeneralNote, GeneralNoteTodoItem } from '../../core/models/models';

@Component({
  selector: 'app-general-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './general-notes.component.html',
})
export class GeneralNotesComponent implements OnInit, OnDestroy {
  private readonly postItOrderStorageKey = 'general_notes_order_v1';

  projects: AppProject[] = [];
  notes: GeneralNote[] = [];

  loading = false;
  saving = false;
  saveError = '';
  saveSuccess = false;

  filterProject = 'ALL';
  searchText = '';
  showFinished = true;

  newNote: GeneralNote = this.createEmptyNote('TEXT');
  newTodoBulkText = '';
  editingId: number | null = null;
  editDraft: GeneralNote = this.createEmptyNote('TEXT');
  editTodoBulkText = '';
  editSaving = false;
  showDeleteModal = false;
  deleteLoading = false;
  deleteTarget: GeneralNote | null = null;

  showNoteModal = false;
  selectedNote: GeneralNote | null = null;
  draggingNoteId: number | null = null;
  draggingTodoIndex: number | null = null;
  draggingPostItId: number | null = null;

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
      const todoText = this.getTodoItems(note).map(item => item.text).join(' ');
      const haystack = `${note.projectName} ${note.protocol ?? ''} ${note.title ?? ''} ${note.noteText} ${todoText}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  ngOnDestroy(): void {
    this.onPostItCardDragEnd();
  }

  loadNotes() {
    this.loading = true;
    this.saveError = '';
    this.svc.getGeneralNotes().pipe(catchError(() => of([]))).subscribe(notes => {
      this.loading = false;
      this.notes = this.applySavedPostItOrder((notes ?? []).map(note => this.normalizeNote(note)));
    });
  }

  addNote() {
    if (this.newNote.noteType === 'TODO') {
      this.newNote.todoItems = this.mergeTodoItemsFromText([], this.newTodoBulkText);
    }
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
      const normalizedCreated = this.normalizeNote(created);
      this.notes = [...this.notes, normalizedCreated];
      this.savePostItOrder();
      this.newNote = this.createEmptyNote('TEXT');
      this.newTodoBulkText = '';
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3000);
    });
  }

  toggleFinished(note: GeneralNote) {
    if (this.isTodo(note)) return;
    if (!note.id) return;
    const next = !note.finished;
    this.saveError = '';
    this.svc.setGeneralNoteFinished(note.id, next).pipe(catchError(() => of(null))).subscribe(updated => {
      if (!updated) {
        this.saveError = 'Nao foi possivel atualizar o status da anotacao.';
        return;
      }
      const normalizedUpdated = this.normalizeNote(updated);
      this.notes = this.notes.map(n => (n.id === normalizedUpdated.id ? normalizedUpdated : n));
    });
  }

  startEdit(note: GeneralNote) {
    this.editingId = note.id ?? null;
    this.editDraft = {
      projectName: note.projectName === 'Geral' ? '' : note.projectName,
      protocol: note.protocol ?? '',
      title: note.title ?? '',
      noteText: note.noteText,
      noteType: note.noteType === 'TODO' ? 'TODO' : 'TEXT',
      sendFinishedToPreDaily: !!note.sendFinishedToPreDaily,
      todoItems: this.getTodoItems(note).map(item => ({ ...item })),
    };
    this.editTodoBulkText = this.getTodoItems(this.editDraft).map(item => item.text).join('\n');
    this.saveError = '';
  }

  cancelEdit() {
    if (this.editSaving) return;
    this.editingId = null;
    this.editDraft = this.createEmptyNote('TEXT');
    this.editTodoBulkText = '';
  }

  saveEdit(note: GeneralNote) {
    if (!note.id) return;
    if (this.editDraft.noteType === 'TODO') {
      this.editDraft.todoItems = this.mergeTodoItemsFromText(this.getTodoItems(this.editDraft), this.editTodoBulkText);
    }
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
      const normalizedUpdated = this.normalizeNote(updated);
      this.notes = this.notes.map(n => (n.id === normalizedUpdated.id ? normalizedUpdated : n));
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
      this.savePostItOrder();
      this.closeDeleteModal();
      this.saveSuccess = true;
      setTimeout(() => (this.saveSuccess = false), 3000);
    });
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR');
  }

  isTodo(note: GeneralNote): boolean {
    if (note.noteType === 'TODO') return true;
    return this.getTodoItems(note).length > 0;
  }

  getTodoItems(note: GeneralNote): GeneralNoteTodoItem[] {
    return (note.todoItems ?? []).filter(item => !!(item.text ?? '').trim());
  }

  getTodoCompletionLabel(note: GeneralNote): string {
    const items = this.getTodoItems(note);
    if (items.length === 0) return '0/0';
    const done = items.filter(item => !!item.finished).length;
    return `${done}/${items.length}`;
  }

  onNewNoteTypeChange() {
    if (this.newNote.noteType !== 'TODO') {
      this.newNote.todoItems = [];
      this.newNote.sendFinishedToPreDaily = false;
      this.newTodoBulkText = '';
    } else {
      this.newNote.noteText = '';
      this.newTodoBulkText = this.getTodoItems(this.newNote).map(item => item.text).join('\n');
    }
  }

  onEditNoteTypeChange() {
    if (this.editDraft.noteType !== 'TODO') {
      this.editDraft.todoItems = [];
      this.editDraft.sendFinishedToPreDaily = false;
      this.editTodoBulkText = '';
    } else {
      this.editDraft.noteText = '';
      this.editTodoBulkText = this.getTodoItems(this.editDraft).map(item => item.text).join('\n');
    }
  }

  toggleTodoItem(note: GeneralNote, item: GeneralNoteTodoItem, finished: boolean, index?: number) {
    if (!note.id || !this.isTodo(note)) return;
    const originalItems = this.getTodoItems(note);
    const payload = this.buildPayload({
      ...note,
      noteType: 'TODO',
      todoItems: originalItems.map((current, currentIndex) => {
        const byId = !!current.id && !!item.id && current.id === item.id;
        const byIndex = !current.id && !item.id && index === currentIndex;
        if (byId || byIndex) {
          return { ...current, finished };
        }
        return { ...current };
      }),
    });
    if (!payload) return;

    this.saveError = '';
    this.svc.updateGeneralNote(note.id, payload).pipe(catchError(() => of(null))).subscribe(updated => {
      if (!updated) {
        this.saveError = 'Nao foi possivel atualizar a tarefa da anotacao.';
        return;
      }
      const normalizedUpdated = this.normalizeNote(updated);
      this.notes = this.notes.map(n => (n.id === normalizedUpdated.id ? normalizedUpdated : n));
      if (this.selectedNote?.id === normalizedUpdated.id) {
        this.selectedNote = normalizedUpdated;
      }
    });
  }

  onTodoDragStart(note: GeneralNote, index: number, event: DragEvent) {
    if (!note.id) return;
    this.draggingNoteId = note.id;
    this.draggingTodoIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${note.id}:${index}`);
    }
  }

  onTodoDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onTodoDrop(note: GeneralNote, toIndex: number, event: DragEvent) {
    event.preventDefault();
    if (!note.id || this.draggingNoteId !== note.id || this.draggingTodoIndex === null) {
      this.clearTodoDragState();
      return;
    }

    const fromIndex = this.draggingTodoIndex;
    this.clearTodoDragState();
    if (fromIndex === toIndex) return;

    this.reorderTodoItems(note, fromIndex, toIndex);
  }

  onTodoDragEnd() {
    this.clearTodoDragState();
  }

  private buildPayload(note: GeneralNote): {
    projectName: string;
    protocol?: string | null;
    title?: string | null;
    noteText: string;
    noteType: 'TEXT' | 'TODO';
    sendFinishedToPreDaily: boolean;
    todoItems: {
      id?: string;
      text: string;
      finished: boolean;
      sentToPreDaily: boolean;
    }[];
  } | null {
    const projectName = (note.projectName ?? '').trim();
    const noteText = (note.noteText ?? '').trim();
    const protocol = (note.protocol ?? '').trim();
    const title = (note.title ?? '').trim();
    const noteType: 'TEXT' | 'TODO' = note.noteType === 'TODO' ? 'TODO' : 'TEXT';

    const todoItems = (note.todoItems ?? [])
      .map(item => ({
        id: item.id,
        text: (item.text ?? '').trim(),
        finished: !!item.finished,
        sentToPreDaily: !!item.sentToPreDaily,
      }))
      .filter(item => !!item.text);

    if (noteType === 'TEXT' && !noteText) {
      this.saveError = 'Texto da anotacao e obrigatorio.';
      return null;
    }
    if (noteType === 'TODO' && todoItems.length === 0) {
      this.saveError = 'Adicione pelo menos uma tarefa no to-do.';
      return null;
    }

    return {
      projectName: projectName || 'Geral',
      noteText: noteType === 'TEXT' ? noteText : (noteText || 'Lista de tarefas'),
      noteType,
      sendFinishedToPreDaily: noteType === 'TODO' ? !!note.sendFinishedToPreDaily : false,
      todoItems,
      protocol: protocol || null,
      title: title || null,
    };
  }

  isNoteTextLarge(note: GeneralNote): boolean {
    if (this.isTodo(note)) return false;
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

  onPostItCardDragStart(note: GeneralNote, event: DragEvent) {
    if (!note.id) return;
    this.draggingPostItId = note.id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(note.id));
    }
  }

  private createEmptyNote(noteType: 'TEXT' | 'TODO'): GeneralNote {
    return {
      projectName: '',
      protocol: '',
      title: '',
      noteText: '',
      noteType,
      sendFinishedToPreDaily: false,
      todoItems: [],
    };
  }

  private normalizeNote(note: GeneralNote): GeneralNote {
    const normalizedItems = (note.todoItems ?? [])
      .map(item => ({
        id: item.id || this.generateTodoId(),
        text: (item.text ?? '').trim(),
        finished: !!item.finished,
        sentToPreDaily: !!item.sentToPreDaily,
      }))
      .filter(item => !!item.text);

    const inferredType: 'TEXT' | 'TODO' = note.noteType === 'TODO' || normalizedItems.length > 0 ? 'TODO' : 'TEXT';

    return {
      ...note,
      noteType: inferredType,
      todoItems: normalizedItems,
      sendFinishedToPreDaily: !!note.sendFinishedToPreDaily,
      noteText: note.noteText ?? '',
    };
  }

  private generateTodoId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  onPostItCardDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onPostItCardDrop(targetNote: GeneralNote, event: DragEvent) {
    event.preventDefault();
    if (!targetNote.id || this.draggingPostItId === null || targetNote.id === this.draggingPostItId) {
      this.draggingPostItId = null;
      return;
    }

    const fromIndex = this.notes.findIndex(n => n.id === this.draggingPostItId);
    const toIndex = this.notes.findIndex(n => n.id === targetNote.id);
    this.draggingPostItId = null;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    this.notes = this.moveItem(this.notes, fromIndex, toIndex);
    this.savePostItOrder();
  }

  onPostItCardDragEnd() {
    this.draggingPostItId = null;
  }

  isPostItMoving(note: GeneralNote): boolean {
    return !!note.id && this.draggingPostItId === note.id;
  }

  private readSavedPostItOrder(): number[] {
    try {
      const raw = localStorage.getItem(this.postItOrderStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(value => Number(value))
        .filter(value => Number.isFinite(value));
    } catch {
      return [];
    }
  }

  private savePostItOrder() {
    const ids = this.notes.map(note => note.id).filter((id): id is number => typeof id === 'number');
    try {
      localStorage.setItem(this.postItOrderStorageKey, JSON.stringify(ids));
    } catch {
      // ignore localStorage errors
    }
  }

  private applySavedPostItOrder(incomingNotes: GeneralNote[]): GeneralNote[] {
    const savedOrder = this.readSavedPostItOrder();
    if (savedOrder.length === 0) return incomingNotes;

    const byId = new Map<number, GeneralNote>();
    for (const note of incomingNotes) {
      if (note.id) byId.set(note.id, note);
    }

    const ordered: GeneralNote[] = [];
    for (const id of savedOrder) {
      const note = byId.get(id);
      if (note) {
        ordered.push(note);
        byId.delete(id);
      }
    }

    const remaining = incomingNotes.filter(note => !note.id || byId.has(note.id));
    const result = [...ordered, ...remaining];
    this.notes = result;
    this.savePostItOrder();
    return result;
  }

  private reorderTodoItems(note: GeneralNote, fromIndex: number, toIndex: number) {
    if (!note.id || !this.isTodo(note)) return;
    const items = this.getTodoItems(note);
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;

    const reordered = this.moveItem(items, fromIndex, toIndex);
    const payload = this.buildPayload({
      ...note,
      noteType: 'TODO',
      todoItems: reordered.map(item => ({ ...item })),
    });
    if (!payload) return;

    this.saveError = '';
    this.svc.updateGeneralNote(note.id, payload).pipe(catchError(() => of(null))).subscribe(updated => {
      if (!updated) {
        this.saveError = 'Nao foi possivel reordenar as tarefas.';
        return;
      }
      const normalizedUpdated = this.normalizeNote(updated);
      this.notes = this.notes.map(n => (n.id === normalizedUpdated.id ? normalizedUpdated : n));
      if (this.selectedNote?.id === normalizedUpdated.id) {
        this.selectedNote = normalizedUpdated;
      }
    });
  }

  private moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    const copy = [...items];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    return copy;
  }

  private clearTodoDragState() {
    this.draggingNoteId = null;
    this.draggingTodoIndex = null;
  }

  getTodoDraftCount(rawText: string): number {
    return this.parseTodoLines(rawText).length;
  }

  private mergeTodoItemsFromText(existingItems: GeneralNoteTodoItem[], rawText: string): GeneralNoteTodoItem[] {
    const lines = this.parseTodoLines(rawText);
    if (lines.length === 0) return [];

    const buckets = new Map<string, GeneralNoteTodoItem[]>();
    for (const item of existingItems) {
      const key = (item.text ?? '').trim().toLowerCase();
      if (!key) continue;
      const queue = buckets.get(key) ?? [];
      queue.push(item);
      buckets.set(key, queue);
    }

    return lines.map(line => {
      const key = line.toLowerCase();
      const queue = buckets.get(key) ?? [];
      const reused = queue.shift();
      if (reused) {
        buckets.set(key, queue);
        return { ...reused, text: line };
      }
      return { id: this.generateTodoId(), text: line, finished: false, sentToPreDaily: false };
    });
  }

  private parseTodoLines(rawText: string): string[] {
    return (rawText ?? '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => !!line);
  }
}
