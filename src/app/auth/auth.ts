import { Injectable } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Router } from '@angular/router'; 
import { tap, takeUntil, catchError } from 'rxjs/operators';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private httpClientWithoutInterceptors: HttpClient;
  private apiUrl = 'https://localhost:7164/identity/auth';   // '/auth' yahan permanently add kar do
  private authCancel$ = new Subject<void>();

  constructor(private http: HttpClient, private router: Router, private httpBackend: HttpBackend) {
    this.httpClientWithoutInterceptors = new HttpClient(this.httpBackend);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;

    try {
      const decoded: JwtPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);

      // Simple check: Agar expiry time se pehle ka time hai to valid hai
      return !!decoded.exp && decoded.exp > currentTime;
    } catch(error) {
      return false;
    }
  }

  register(data: { username: string; password: string; email: string }): Observable<any> {
    this.authCancel$.next(); 
    return this.http.post(`${this.apiUrl}/register`, data)
      .pipe(takeUntil(this.authCancel$));
  }

  login(email: string, password: string): Observable<any> {
    this.authCancel$.next(); 
    return this.http.post(`${this.apiUrl}/login`, { email, password }, {
      withCredentials: true // ✅ FIX 1: Taake backend login response me cookie set kar sake
    }).pipe(
      takeUntil(this.authCancel$),
      tap((res: any) => {
        if (res.accessToken) {
          localStorage.setItem('accessToken', res.accessToken); // ✅ Sirf access token save hoga
        }
      })
    );
  }
ssoLogin(accessToken: string): Observable<any> {
  return this.http.post(`${this.apiUrl}/sso/callback`, { accessToken });
}
  // 🔄 Token Rotation Handler
  tryRefreshToken(): Observable<any> {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
      return of(null);
    }

    // ✅ FIX 2: Purana access token headers me jayega pehchan ke liye
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });

    return this.httpClientWithoutInterceptors
      .post<any>(`${this.apiUrl}/refreshToken`, {}, { 
        headers, 
        withCredentials: true // ✅ FIX 3: Yeh line browser ko majboor karegi cookie sath bhejne par
      })
      .pipe(
       tap(res => {
          if (res && res.accessToken) {
            localStorage.setItem('accessToken', res.accessToken); // Naya token update
          }
        }),
        catchError((error) => {
          this.logoutOnFailure(); // Refresh fail ho to local state clear karein
          return throwError(() => error);
        })
      );
  }

 logout() {
    const accessToken = localStorage.getItem('accessToken');
    let authHeaders = new HttpHeaders();

    if (accessToken) {
      authHeaders = authHeaders.set('Authorization', `Bearer ${accessToken}`);
    }

    // ✅ FIX 4: Request options me headers aur withCredentials dono bheinjein gey
    this.http.post(`${this.apiUrl}/logout`, {}, { 
      headers: authHeaders,
      withCredentials: true // Browser ko cookie sath bhejne dega taake backend cookie delete kar sake
    }).subscribe({
      next: () => {
        this.clearLocalStorageAndRedirect();
      },
      error: (err) => {
        console.error('Logout failed', err);
        this.clearLocalStorageAndRedirect();
      }
    });
  }

  private logoutOnFailure() {
    this.clearLocalStorageAndRedirect();
  }

  private clearLocalStorageAndRedirect() {
    localStorage.removeItem('accessToken'); // ✅ Code fully cleaned from LocalStorage RefreshToken leaks
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string) {
    this.authCancel$.next(); 
    return this.http.post(`${this.apiUrl}/forgot-password`, { email })
    .pipe(takeUntil(this.authCancel$));
  }

  resetPassword(model: any) {
    this.authCancel$.next(); 
    return this.http.post(`${this.apiUrl}/reset-password`, model);
  }
}
