import { Component, computed, effect, input, signal } from '@angular/core';
import { initialsOf } from '../../pages/people/people.models';

/**
 * Avatar ka andar wala hissa: photo ho to <img>, warna initials.
 * Bahar ka circle (size, rang) parent ki .avatar / .avatar-xl class deti hai.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" (error)="failed.set(true)" />
    } @else {
      {{ letters() }}
    }
  `,
  styles: `
    :host { display: contents; }
    img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  `
})
export class AvatarComponent {
  readonly name = input('');
  readonly src = input<string | null | undefined>(null);
  /** Pehle se bane initials (CurrentUser.initials) — warna name se */
  readonly initials = input<string | null>(null);

  readonly failed = signal(false);
  readonly letters = computed(() => this.initials() ?? (this.name() ? initialsOf(this.name()) : ''));

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false);   // naya URL aaya to dobara try
    });
  }
}
