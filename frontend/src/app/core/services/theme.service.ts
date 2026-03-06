import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _dark = new BehaviorSubject<boolean>(localStorage.getItem('theme') !== 'light');
  isDark$ = this._dark.asObservable();

  constructor() { this.apply(this._dark.value); }

  toggle() { this._dark.next(!this._dark.value); this.apply(this._dark.value); }

  get isDark() { return this._dark.value; }

  private apply(dark: boolean) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }
}
