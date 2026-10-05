import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AlertService, AlertType } from '../../services/alert/alert';

const ICONS: Record<AlertType, string> = {
  success: 'check',
  error: 'priority_high',
  info: 'info',
  warning: 'warning_amber'
};

/**
 * Ledger slip: kaghaz jaisa toast, side pe rang ki patti, mohar (seal) jaisa icon.
 * Signals pe — pehle plain fields change detection ke beech badalte the (NG0100).
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './alert.html',
  styleUrl: './alert.css'
})
export class AlertComponent {
  private readonly alertService = inject(AlertService);

  readonly alert = toSignal(this.alertService.alert$, { initialValue: null });
  readonly visible = signal(false);
  readonly paused = signal(false);
  readonly icon = computed(() => ICONS[this.alert()?.type ?? 'info']);
  private shownAt = 0;

  constructor() {
    effect(() => {
      if (this.alert()) {
        this.visible.set(false);
        this.paused.set(false);
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

  pause(): void {
    this.paused.set(true);
    this.alertService.pause();
  }

  resume(): void {
    this.paused.set(false);
    this.alertService.resume();
  }

  /** Bahar click pe band — lekin dikhne ke foran baad wala click (jisne alert khola) nahi */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.alert() || Date.now() - this.shownAt < 300) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.slip')) return;
    this.close();
  }
}
