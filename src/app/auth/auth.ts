import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router'; 

@Injectable({
  providedIn: 'root' // this means the service is available application-wide
})
export class AuthService {

  private apiUrl = 'https://localhost:7049/api/values';

  constructor(private http: HttpClient,private router:Router) {}

  isAuthenticated(): boolean {
    const authToken = localStorage.getItem('accessToken');
    return !!authToken;
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
    // this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
    //   next: () => {
    //     this.clearLocalStorageAndRedirect();
    //   },
    //   error: (err) => {
    //     console.error('Logout failed', err);
    //     // Agar API fail bhi ho jaye, tab bhi client side se tokens saaf kar dena behtar hai
    //     this.clearLocalStorageAndRedirect();
    //   }
    // });
  }
  private clearLocalStorageAndRedirect() {
    localStorage.removeItem('accessToken'); 
    // Agar koi aur data hai to wo bhi clear kar dein
    // localStorage.clear(); 
    this.router.navigate(['/login']);
  }
}