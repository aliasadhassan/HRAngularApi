import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '../../core/layout/layout.service';
import { CurrentUserService } from '../../core/auth/current-user';
import { MyPhotoService } from '../../core/auth/my-photo';
import { AvatarComponent } from '../avatar/avatar';
import { PermissionService } from '../../core/auth/permissions';
import { NAV_SECTIONS, NAV_SETTINGS, NavSection } from './nav';

@Component({
  selector: 'app-sidebar',
  imports: [AvatarComponent, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  host: {
    '[class.is-collapsed]': 'layout.collapsed()',
    '[class.is-mobile-open]': 'layout.mobileOpen()'
  }
})
export class SidebarComponent {
  readonly layout = inject(LayoutService);
  readonly user = inject(CurrentUserService).get();
  readonly myPhoto = inject(MyPhotoService);
  private readonly permissions = inject(PermissionService);

  constructor() {
    this.myPhoto.load();   // apni photo ek dafa (har user ke liye) — warna initials
  }

  // Accordion: default mein koi module open nahi.
  readonly expandedSections = signal<Record<string, boolean>>({});

  /** Permission filter + empty sections remove. */
  readonly sections: NavSection[] = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => this.permissions.hasAny(item.permission))
    }))
    .filter(section => section.items.length > 0);

  readonly settings = NAV_SETTINGS;

  isSectionExpanded(section: NavSection): boolean {
    return section.title ? (this.expandedSections()[section.title] ?? false) : true;
  }

  toggleSection(section: NavSection): void {
    if (!section.title) {
      return;
    }

    this.expandedSections.update(state => {
      const isOpen = state[section.title!] ?? false;

      return {
        ...Object.keys(state).reduce(
          (next, key) => ({ ...next, [key]: false }),
          {} as Record<string, boolean>
        ),
        [section.title!]: !isOpen
      };
    });
  }

  onNavigate(): void {
    this.layout.closeMobile();
  }
}