import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AuthService } from '../auth/auth';

@Component({
  standalone: true,
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.html',
  styleUrls: ['./auth-callback.css'],
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private msalService: MsalService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.msalService.handleRedirectObservable().subscribe({
      next: (result) => {
        console.log('AuthCallback: redirect result', result);

        const account = result?.account ?? this.msalService.instance.getAllAccounts()[0];

        if (!account) {
          console.log('AuthCallback: no account found, redirecting to login');
          this.router.navigate(['/login']);
          return;
        }

        this.msalService.instance.setActiveAccount(account);

        this.msalService.instance.acquireTokenSilent({
          scopes: ['user.read'],
          account
        }).then((tokenResult) => {
          console.log('AuthCallback: silent token acquired', tokenResult);
          this.authService.ssoLogin(tokenResult.accessToken).subscribe({
            next: (response) => {
              console.log('AuthCallback: SSO backend success', response);
              localStorage.setItem('accessToken', response.accessToken);
              this.router.navigate(['/app/dashboard']);
            },
            error: (error) => {
              console.error('AuthCallback: SSO backend exchange failed:', error);
            }
          });
        }).catch((error) => {
          console.error('AuthCallback: Silent token acquisition failed:', error);
        });
      },
      error: (err) => {
        console.error('AuthCallback: handleRedirectObservable error', err);
        this.router.navigate(['/login']);
      }
    });
  }
}