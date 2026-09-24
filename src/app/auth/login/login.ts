import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { MsalService } from '@azure/msal-angular';
import { AuthService } from '../auth';
import { LoaderService } from '../../services/loader/loader';
import { AlertService } from '../../services/alert/alert';

interface LoginErrorBody {
  code?: 'INVALID_CREDENTIALS' | 'LOCKED_OUT' | 'SSO_ONLY' | 'ACCOUNT_DISABLED';
  message?: string;
  retryAfterSeconds?: number;
}

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnDestroy {
  loginForm: FormGroup;
  error = '';
  hidePassword = true;
  isSubmitting = false;
  today = new Date();

  lockoutSeconds = 0;
  ssoOnly = false;
  private lockoutTimer?: ReturnType<typeof setInterval>;

  constructor(
    public loaderService: LoaderService,
    private alert: AlertService,
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private msalService: MsalService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get isLockedOut(): boolean {
    return this.lockoutSeconds > 0;
  }

  get lockoutDisplay(): string {
    const m = Math.floor(this.lockoutSeconds / 60);
    const s = this.lockoutSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  signInWithSSO(): void {
    this.msalService.loginRedirect({
      scopes: ['user.read'],
      redirectStartPage: window.location.origin + '/auth-callback'
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  login(): void {
    this.error = '';
    this.ssoOnly = false;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    if (this.isLockedOut || this.isSubmitting) return;

    this.isSubmitting = true;
    const { email, password } = this.loginForm.value;

    this.authService
      .login(email, password)
      .pipe(finalize(() => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => this.router.navigate(['/app/dashboard']),
        error: (err: HttpErrorResponse) => this.handleLoginError(err)
      });
  }

  private handleLoginError(err: HttpErrorResponse): void {
    const body: LoginErrorBody = err.error ?? {};

    switch (body.code) {
      case 'LOCKED_OUT':
        this.error = body.message ?? 'Account is temporarily locked.';
        this.startLockoutCountdown(body.retryAfterSeconds ?? 15 * 60);
        break;

      case 'SSO_ONLY':
        this.error = body.message ?? 'This account uses Microsoft sign-in.';
        this.ssoOnly = true;
        break;

      case 'INVALID_CREDENTIALS':
      case 'ACCOUNT_DISABLED':
        this.error = body.message ?? 'Invalid email or password';
        this.loginForm.get('password')?.reset();
        break;

      default:
        // Network / 500 / gateway errors — toast
        this.alert.error(
          err.status === 0 ? 'Server is unreachable. Please try again.' : body.message ?? 'An unexpected error occurred'
        );
    }
    this.cdr.markForCheck();
  }

  private startLockoutCountdown(seconds: number): void {
    this.clearLockoutTimer();
    this.lockoutSeconds = seconds;

    this.lockoutTimer = setInterval(() => {
      this.lockoutSeconds--;
      if (this.lockoutSeconds <= 0) {
        this.clearLockoutTimer();
        this.lockoutSeconds = 0;
        this.error = '';
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  private clearLockoutTimer(): void {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.clearLockoutTimer();
  }
}