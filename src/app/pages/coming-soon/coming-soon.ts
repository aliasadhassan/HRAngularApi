import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Jo sections abhi ban rahe hain unka route — login pe redirect ke bajaye saaf message. */
@Component({
  selector: 'app-coming-soon',
  imports: [TranslatePipe, RouterLink],
  template: `
    <section class="soon">
      <span class="material-icons-outlined" aria-hidden="true">construction</span>
      <h2>{{ titleKey | translate }}</h2>
      <p>{{ 'comingSoon.body' | translate }}</p>
      <a routerLink="/app/dashboard">{{ 'comingSoon.back' | translate }}</a>
    </section>
  `,
  styles: `
    .soon {
      max-width: 420px;
      margin: 12vh auto 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .material-icons-outlined { font-size: 40px; color: var(--brass); }
    h2 { font-size: var(--fs-28); }
    p { margin: 0; color: var(--text-muted); }
    a { margin-top: 8px; color: var(--moss); font-weight: 500; }
  `
})
export class ComingSoonComponent {
  readonly titleKey: string = inject(ActivatedRoute).snapshot.data['titleKey'] ?? 'nav.dashboard';
}
