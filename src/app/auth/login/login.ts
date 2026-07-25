import { Component, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../auth';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink,Router } from '@angular/router'; // Required for routerLink
import { LoaderService } from '../../services/loader/loader';
import { AlertService } from '../../services/alert/alert';
import { MsalService } from '@azure/msal-angular';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink], // Added RouterLink
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  error = '';
  hidePassword = true;
  isSubmitting = false;
  today = new Date();

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
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }
  signInWithSSO(): void {
    this.msalService.loginPopup({
      scopes: ['user.read']
    }).subscribe({
      next: (result) => {
        console.log('Microsoft login successful:', result);
        // Yahan se access token backend (hr-identity-api) ko bhejenge
        this.sendTokenToBackend(result.accessToken);
      },
      error: (error) => {
        console.error('SSO login failed:', error);
      }
    });
  }
private sendTokenToBackend(microsoftToken: string): void {
  this.authService.ssoLogin(microsoftToken).subscribe({
    next: (response) => {
      // Jaisa normal login response handle karte ho waisa hi
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      this.router.navigate(['/dashboard']);
    },
    error: (error) => {
      console.error('SSO backend exchange failed:', error);
    }
  });
}

   togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  login() {
    this.error = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        if (err?.status === 401) {
          this.alert.error('Invalid email or password');
        } else if (err?.error?.message) {
          this.alert.error(err.error.message);
        } else {
          this.alert.error('An unexpected error occurred');
        }
      }
    });
  }
}