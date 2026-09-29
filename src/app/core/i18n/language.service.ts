import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

export type AppLanguage = 'en' | 'ar';

const STORAGE_KEY = 'lang';
const RTL_LANGUAGES: readonly AppLanguage[] = ['ar'];

/**
 * Ek hi jagah jo language badalti hai: translations + <html lang/dir> + yaad rakhna.
 * Components sirf `language()` / `isRtl()` padhte hain aur `use()` bulate hain.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly supported: readonly AppLanguage[] = ['en', 'ar'];
  readonly language = signal<AppLanguage>('en');
  readonly isRtl = computed(() => RTL_LANGUAGES.includes(this.language()));

  /** App start pe (APP_INITIALIZER): saved language, warna English. */
  init(): Observable<unknown> {
    this.translate.setFallbackLang('en');
    return this.use(this.savedLanguage());
  }

  use(lang: AppLanguage): Observable<unknown> {
    this.language.set(lang);

    const html = this.document.documentElement;
    html.lang = lang;
    html.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* private mode: language sirf is session ke liye */
    }

    return this.translate.use(lang);
  }

  toggle(): void {
    this.use(this.language() === 'en' ? 'ar' : 'en').subscribe();
  }

  private savedLanguage(): AppLanguage {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (this.supported as readonly string[]).includes(saved)) {
        return saved as AppLanguage;
      }
    } catch {
      /* ignore */
    }
    return 'en';
  }
}
