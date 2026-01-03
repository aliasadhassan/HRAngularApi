import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Router } from '@angular/router'; 
import { tap, catchError } from 'rxjs/operators';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Bina interceptor wala client taake refresh call loop mein na phanse
  private httpClientWithoutInterceptors: HttpClient;
  private apiUrl = 'https://localhost:7049/api/auth';

  constructor(private http: HttpClient, private router: Router, private httpBackend: HttpBackend) {
    this.httpClientWithoutInterceptors = new HttpClient(this.httpBackend);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;

    try {
      const decoded: JwtPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      // Agar token expire ho chuka hai to true return karein taake 
      // interceptor isko catch karke refresh process shuru kare
      return !!decoded; 
    } catch (error) {
      return false;
    }
  }

  register(data: { username: string; password: string; email: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res: any) => {
        if (res.accessToken) {
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken); // Refresh token bhi save karein
        }
      })
    );
  }

  // --- Sabse Main Change Yahan Hai ---
  tryRefreshToken(): Observable<any> {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken'); // Refresh token uthayein

    if (!accessToken || !refreshToken) {
      return of(null);
    }

    // Headers set karein (Donon tokens bhej rahe hain jaisa aapne bataya)
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'X-Refresh-Token': refreshToken // Ya jo bhi aapke backend ki header key hai
    });

    return this.httpClientWithoutInterceptors
      .post<any>(`${this.apiUrl}/refreshToken`, {}, { headers })
      .pipe(
       tap(res => {
          if (res && res.accessToken) {
            localStorage.setItem('accessToken', res.accessToken);
            localStorage.setItem('refreshToken', res.refreshToken);
          }
        }),
        catchError((error) => {
          this.logout(); // Agar refresh fail ho jaye to seedha logout
          return throwError(() => error);
        })
      );
  }

logout() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken'); // Refresh token bhi uthayein
  
  let authHeaders = new HttpHeaders();

  if (accessToken) {
    authHeaders = authHeaders.set('Authorization', `Bearer ${accessToken}`);
  }
  // Agar backend ko ye bhi chahiye to is line ko lazmi add karein
  if (refreshToken) {
      authHeaders = authHeaders.set('X-Refresh-Token', refreshToken); 
  }

  // 3. Request options mein headers pass karein
  this.http.post(`${this.apiUrl}/logout`, {}, { headers: authHeaders }).subscribe({
    next: () => {
      this.clearLocalStorageAndRedirect();
    },
    error: (err) => {
      console.error('Logout failed', err);
      // API fail bhi ho jaye to user ko login screen par bhejna zaroori hai
      this.clearLocalStorageAndRedirect();
    }
  });
}

  private clearLocalStorageAndRedirect() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(model: any) {
    return this.http.post(`${this.apiUrl}/reset-password`, model);
  }

}
