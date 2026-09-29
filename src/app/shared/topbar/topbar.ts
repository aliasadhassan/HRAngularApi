import { Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../auth/auth';
import { LanguageService } from '../../core/i18n/language.service';
import { LayoutService } from '../../core/layout/layout.service';
import { CurrentUserService } from '../../core/auth/current-user';

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class TopbarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly language = inject(LanguageService);
  readonly layout = inject(LayoutService);
  readonly user = inject(CurrentUserService).get();
  readonly menuOpen = signal(false);

  /** Page ka title route ke `data.titleKey` se — har page khud apna naam batata hai. */
  readonly titleKey = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        return (r.data?.['titleKey'] as string | undefined) ?? 'nav.dashboard';
      })
    ),
    { initialValue: 'nav.dashboard' }
  );

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update(open => !open);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
    this.layout.closeMobile();
  }

  logout(): void {
    this.auth.logout();
  }
}
