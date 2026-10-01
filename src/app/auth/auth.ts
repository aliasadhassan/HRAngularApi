import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError, timer } from 'rxjs';
import { tap, takeUntil, map, retry, finalize, shareReplay } from 'rxjs/operators';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { environment } from '../../environments/environment';

interface TokenResponse {
  accessToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiGatewayUrl}/identity/auth`;
  private readonly httpClientWithoutInterceptors: HttpClient;
  private authCancel$ = new Subject<void>();

  private refreshInFlight$: Observable<string> | null = null;

  constructor(private http: HttpClient, private router: Router, httpBackend: HttpBackend) {
    this.httpClientWithoutInterceptors = new HttpClient(httpBackend);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;

    try {
      const decoded: JwtPayload = jwtDecode(token);
      return !!decoded.exp && decoded.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  register(data: { username: string; password: string; email: string }): Observable<any> {
    this.authCancel$.next();
    return this.http.post(`${this.apiUrl}/register`, data).pipe(takeUntil(this.authCancel$));
  }

  login(email: string, password: string): Observable<TokenResponse> {
    this.authCancel$.next();
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true })
      .pipe(
        takeUntil(this.authCancel$),
        tap(res => this.storeAccessToken(res?.accessToken))
      );
  }

  ssoLogin(accessToken: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/sso/callback`, { accessToken }, { withCredentials: true })
      .pipe(tap(res => this.storeAccessToken(res?.accessToken)));
  }

  refreshAccessToken(): Observable<string> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.httpClientWithoutInterceptors
        .post<TokenResponse>(`${this.apiUrl}/refreshToken`, {}, { withCredentials: true })
        .pipe(
          retry({
            count: 1,
            delay: (err: HttpErrorResponse) => (err.status === 409 ? timer(300) : throwError(() => err))
          }),
          map(res => {
            if (!res?.accessToken) throw new Error('Refresh response did not contain an access token');
            return res.accessToken;
          }),
          tap(token => this.storeAccessToken(token)),
          finalize(() => (this.refreshInFlight$ = null)),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this.refreshInFlight$;
  }

  logout(): void {
    this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(finalize(() => this.endSession()))
      .subscribe({ error: err => console.error('Logout failed', err) });
  }

  endSession(): void {
    localStorage.removeItem('accessToken');
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string) {
    this.authCancel$.next();
    return this.http.post(`${this.apiUrl}/forgot-password`, { email }).pipe(takeUntil(this.authCancel$));
  }

  resetPassword(model: any) {
    this.authCancel$.next();
    return this.http.post(`${this.apiUrl}/reset-password`, model).pipe(takeUntil(this.authCancel$));
  }

  private storeAccessToken(token?: string): void {
    if (token) localStorage.setItem('accessToken', token);
  }
}