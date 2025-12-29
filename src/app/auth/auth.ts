import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router'; 
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { jwtDecode, JwtPayload } from 'jwt-decode'; // Imports the library
import { HttpBackend, HttpClient } from '@angular/common/http'; // HttpBackend add karein

@Injectable({
  providedIn: 'root' // this means the service is available application-wide
})
export class AuthService {

  private httpClientWithoutInterceptors: HttpClient;
  
  private apiUrl = 'https://localhost:7049/api/values';

  constructor(private http: HttpClient, private router: Router, private httpBackend: HttpBackend) {
    this.httpClientWithoutInterceptors = new HttpClient(this.httpBackend);
  }

  isAuthenticated(): boolean {
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      return false; // Token hai hi nahi
    }

    try {
      const decodedToken: JwtPayload = jwtDecode(authToken);
      const currentTime = Date.now() / 1000; // Current time in seconds

      // Agar expiration time (exp) current time se kam hai, to token expire ho chuka hai
      if (decodedToken.exp && decodedToken.exp < currentTime) {
        console.log('Token expired. Logging out.');
        // Zaroorat parne par yahan logout logic bhi add kar sakte hain
        localStorage.removeItem('accessToken'); 
        return false;
      }

      return true; // Token valid hai aur expire nahi hua
    } catch (error) {
      // Agar token invalid format mein hai to decode fail ho jayega, is case mein false return karein
      console.error('Invalid token format:', error);
      localStorage.removeItem('accessToken');
      return false;
    }
  }

  register(data: { username: string; password: string; email: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

 login(email: string, password: string): Observable<any> {
  return this.http.post(`${this.apiUrl}/login`, {
    email: email, 
    password: password
  });
 }
 logout() {
    // Backend ko logout hit karein (withCredentials true lazmi hai agar cookie use ho rahi hai)
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        this.clearLocalStorageAndRedirect();
      },
      error: (err) => {
        console.error('Logout failed', err);
        // Agar API fail bhi ho jaye, tab bhi client side se tokens saaf kar dena behtar hai
        this.clearLocalStorageAndRedirect();
      }
    });
  }
  private clearLocalStorageAndRedirect() {
    localStorage.removeItem('accessToken'); 
    // Agar koi aur data hai to wo bhi clear kar dein
    //localStorage.clear(); 
    this.router.navigate(['/login']);
  }

  tryRefreshToken(): Observable<any> {
  const token = localStorage.getItem('accessToken');
  if (!token) return of(null);

  // POST parameters: (url, body, options)
  return this.httpClientWithoutInterceptors
    .post<any>(
      `${this.apiUrl}/refreshToken`, 
      {}, // Empty body (or add { refreshToken: '...' } if required by your API)
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    .pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem('accessToken', res.token);
        }
      }),
      catchError((error) => {
        console.error('Refresh token failed', error);
        localStorage.removeItem('accessToken');
        return of(null);
      })
    );
 }
}