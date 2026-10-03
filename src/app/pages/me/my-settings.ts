import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AppLanguage, LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';

interface Me {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  hasPassword: boolean;
  tenant: { id: string; name: string; logoUrl: string | null };
  roles: string[];
  permissions: string[];
}

@Component({
  selector: 'app-my-settings',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './my-settings.html',
  styleUrl: './my-settings.css'
})
export class MySettingsComponent {
  private readonly http = inject(HttpClient);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  readonly language = inject(LanguageService);
  private readonly url = `${environment.apiGatewayUrl}/identity/me`;

  readonly me = signal<Me | null>(null);
  readonly saving = signal<'name' | 'password' | null>(null);
  name = '';
  pwd = { current: '', next: '', confirm: '' };
  readonly showPwd = signal(false);

  constructor() {
    this.http.get<Me>(this.url).subscribe({
      next: m => {
        this.me.set(m);
        this.name = m.displayName;
      },
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('mySettings.errorLoad')))
    });
  }

  initials(): string {
    const parts = (this.me()?.displayName ?? '').split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? '').toUpperCase();
  }

  setLanguage(lang: AppLanguage): void {
    this.language.use(lang).subscribe();
  }

  saveName(): void {
    const n = this.name.trim();
    if (!n || n === this.me()?.displayName) return;
    this.saving.set('name');
    this.http.put<void>(this.url, { displayName: n }).subscribe({
      next: () => {
        this.saving.set(null);
        this.me.update(m => (m ? { ...m, displayName: n } : m));
        this.alert.success(this.translate.instant('mySettings.nameSaved'));
      },
      error: e => {
        this.saving.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  pwdError(): string | null {
    const p = this.pwd;
    if (p.next && p.next.length < 8) return 'mySettings.pwdShort';
    if (p.confirm && p.next !== p.confirm) return 'mySettings.pwdMismatch';
    return null;
  }

  canChangePwd(): boolean {
    const p = this.pwd;
    return !!(p.current && p.next && p.next === p.confirm && !this.pwdError());
  }

  changePassword(): void {
    if (!this.canChangePwd()) return;
    this.saving.set('password');
    this.http.post<void>(`${this.url}/password`, { currentPassword: this.pwd.current, newPassword: this.pwd.next }).subscribe({
      next: () => {
        this.saving.set(null);
        this.alert.success(this.translate.instant('mySettings.pwdChanged'));
        // Backend ne saare sessions band kar diye — dobara login
        localStorage.removeItem('accessToken');
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: e => {
        this.saving.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }
}
