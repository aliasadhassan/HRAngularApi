import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AlertService } from '../../services/alert/alert';

/** Signals pe — pehle plain fields change detection ke beech badalte the (NG0100). */
@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './alert.html',
  styleUrl: './alert.css'
})
export class AlertComponent {
  private readonly alertService = inject(AlertService);

  readonly alert = toSignal(this.alertService.alert$, { initialValue: null });
  readonly visible = signal(false);
  private shownAt = 0;

  constructor() {
    effect(() => {
      if (this.alert()) {
        this.visible.set(false);
        this.shownAt = Date.now();
        setTimeout(() => this.visible.set(true), 10);
      } else {
        this.visible.set(false);
      }
    });
  }

  close(): void {
    this.alertService.clear();
  }

  /** Bahar click pe band — lekin dikhne ke foran baad wala click (jisne alert khola) nahi */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.alert() || Date.now() - this.shownAt < 300) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.alert')) return;
    this.close();
  }
}
