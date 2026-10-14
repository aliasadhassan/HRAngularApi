import { Injectable, inject, signal } from '@angular/core';
import { PeopleService } from '../../pages/people/people.service';
import { CurrentUserService } from './current-user';

/** Login wale user ki photo — topbar, sidebar, My settings sab yahi signal padhte hain. */
@Injectable({ providedIn: 'root' })
export class MyPhotoService {
  private readonly api = inject(PeopleService);
  private readonly currentUser = inject(CurrentUserService);
  /** Kis user ke liye load hua — logout ke baad doosra user aaye to purani photo na dikhe */
  private loadedFor: string | null = null;

  readonly enabled = signal(false);
  readonly employeeId = signal<string | null>(null);
  readonly photoUrl = signal<string | null>(null);

  load(force = false): void {
    const who = this.currentUser.get().email || 'anon';
    if (this.loadedFor === who && !force) return;
    if (this.loadedFor !== who) this.photoUrl.set(null);
    this.loadedFor = who;
    this.api.getMyPhoto().subscribe({
      next: p => {
        this.enabled.set(p.enabled);
        this.employeeId.set(p.employeeId);
        this.photoUrl.set(p.photoUrl);
      },
      error: () => (this.loadedFor = null)   // initials hi dikhenge; agli dafa phir try
    });
  }

  /** Kisi bhi page se photo badli — agar woh meri thi to avatar foran badlo. */
  changed(employeeId: string, url: string | null): void {
    if (employeeId === this.employeeId()) this.photoUrl.set(url);
  }
}
