import { Injectable, signal } from '@angular/core';

const COLLAPSED_KEY = 'sidebar-collapsed';

/** Sidebar ki state: desktop pe collapse (yaad rehta hai), mobile pe drawer open/close. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly collapsed = signal(this.readCollapsed());
  readonly mobileOpen = signal(false);

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  openMobile(): void {
    this.mobileOpen.set(true);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
