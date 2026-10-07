import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AppLanguage, LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { LoginMethod, describeDevice, utc } from '../admin/admin.models';

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
  passwordMinLength: number;
  lastLoginAt: string | null;
}

interface MySession {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

interface MySignIn {
  id: number;
  occurredAt: string;
  method: LoginMethod;
  succeeded: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

@Component({
  selector: 'app-my-settings',
  imports: [FormsModule, TranslatePipe, DatePipe],
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

  readonly sessions = signal<MySession[] | null>(null);
  readonly signIns = signal<MySignIn[] | null>(null);
  /** Pehla click = "dobara click karo", doosra = asli sign out (session id ya 'others'). */
  readonly confirming = signal<string | null>(null);
  readonly revoking = signal<string | null>(null);

  readonly utc = utc;
  readonly describeDevice = describeDevice;

  constructor() {
    this.http.get<Me>(this.url).subscribe({
      next: m => {
        this.me.set(m);
        this.name = m.displayName;
      },
      error: e => this.alert.error(PayrollService.errorMessage(e, this.translate.instant('mySettings.errorLoad')))
    });
    this.loadSessions();
    this.http.get<MySignIn[]>(`${this.url}/login-activity`).subscribe({
      next: list => this.signIns.set(list),
      error: () => this.signIns.set([])
    });
  }

  private loadSessions(): void {
    this.http.get<MySession[]>(`${this.url}/sessions`).subscribe({
      next: list => this.sessions.set(list),
      error: e => {
        this.sessions.set([]);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('mySettings.errorSessions')));
      }
    });
  }

  otherSessions(): number {
    return (this.sessions() ?? []).filter(s => !s.isCurrent).length;
  }

  signOut(target: string): void {
    if (this.confirming() !== target) {
      this.confirming.set(target);
      return;
    }
    this.confirming.set(null);
    this.revoking.set(target);
    const req: Observable<{ revoked: number } | null> =
      target === 'others'
        ? this.http.post<{ revoked: number }>(`${this.url}/sessions/revoke-others`, {})
        : this.http.delete<null>(`${this.url}/sessions/${target}`);
    req.subscribe({
      next: res => {
        this.revoking.set(null);
        this.alert.success(
          target === 'others'
            ? this.translate.instant('mySettings.othersRevoked', { n: res?.revoked ?? 0 })
            : this.translate.instant('mySettings.sessionRevoked')
        );
        this.loadSessions();
      },
      error: e => {
        this.revoking.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('payrollSetup.errors.save')));
      }
    });
  }

  reasonKey(a: MySignIn): string {
    return a.succeeded ? 'admin.activity.reason.success' : `admin.activity.reason.${a.failureReason ?? 'Unknown'}`;
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

  minLength(): number {
    return this.me()?.passwordMinLength ?? 8;
  }

  pwdError(): string | null {
    const p = this.pwd;
    if (p.next && p.next.length < this.minLength()) return 'mySettings.pwdShort';
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
