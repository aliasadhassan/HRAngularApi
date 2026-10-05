import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

export type AppLanguage = 'en' | 'ar' | 'zh' | 'tr';

export interface LanguageOption {
  code: AppLanguage;
  /** Apni zabaan mein naam — har language mein same dikhta hai, translate nahi hota */
  nativeName: string;
  /** Topbar ke chhote button pe */
  short: string;
  rtl: boolean;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', nativeName: 'English', short: 'EN', rtl: false },
  { code: 'ar', nativeName: 'العربية', short: 'ع', rtl: true },
  { code: 'zh', nativeName: '中文（简体）', short: '中', rtl: false },
  { code: 'tr', nativeName: 'Türkçe', short: 'TR', rtl: false }
];

const STORAGE_KEY = 'lang';
/** Chinese fonts bhaari hain — bundle mein nahi, sirf 'zh' chunne pe (unicode-range chunks) */
const CJK_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@500;600&display=swap';

/**
 * Ek hi jagah jo language badalti hai: translations + <html lang/dir> + yaad rakhna.
 * Components sirf `language()` / `isRtl()` padhte hain aur `use()` bulate hain.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly options = LANGUAGES;
  readonly supported: readonly AppLanguage[] = LANGUAGES.map(l => l.code);
  readonly language = signal<AppLanguage>('en');
  readonly current = computed(() => LANGUAGES.find(l => l.code === this.language()) ?? LANGUAGES[0]);
  readonly isRtl = computed(() => this.current().rtl);

  /** App start pe (APP_INITIALIZER): saved language, warna English. */
  init(): Observable<unknown> {
    this.translate.setFallbackLang('en');
    return this.use(this.savedLanguage());
  }

  use(lang: AppLanguage): Observable<unknown> {
    this.language.set(lang);
    const option = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

    const html = this.document.documentElement;
    html.lang = lang;
    html.dir = option.rtl ? 'rtl' : 'ltr';
    if (lang === 'zh') this.loadCjkFonts();

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* private mode: language sirf is session ke liye */
    }

    return this.translate.use(lang);
  }

  private loadCjkFonts(): void {
    if (this.document.getElementById('cjk-fonts')) return;
    const link = this.document.createElement('link');
    link.id = 'cjk-fonts';
    link.rel = 'stylesheet';
    link.href = CJK_FONTS_HREF;
    this.document.head.appendChild(link);
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
