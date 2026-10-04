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
      @if (tabs.length) {
        <p class="tabs-label">{{ 'comingSoon.tabs' | translate }}</p>
        <ul class="tabs">
          @for (tab of tabs; track tab) {
            <li>{{ 'comingSoon.tab.' + tab | translate }}</li>
          }
        </ul>
      }
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
    .tabs-label { margin-top: 8px; font-size: var(--fs-12); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .tabs li { padding: 4px 10px; border: 1px solid var(--rule-strong); border-radius: 999px; font-size: var(--fs-13); color: var(--ink, inherit); }
  `
})
export class ComingSoonComponent {
  private readonly data = inject(ActivatedRoute).snapshot.data;
  readonly titleKey: string = this.data['titleKey'] ?? 'nav.dashboard';
  /** Page ke planned tabs (app.routes.ts PLANNED) — taake dikhe ke ye page kya kya cover karega. */
  readonly tabs: readonly string[] = this.data['tabs'] ?? [];
}
