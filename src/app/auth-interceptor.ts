import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth/auth'; // Path set ho gaya
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  
  const authService = inject(AuthService); // Service inject karein

  // Request ko clone karein (Headers aur Cookies ke liye)
  const authReq = req.clone({
    withCredentials: true 
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // Agar server se 401 (Unauthorized) response aaye
      if (error.status === 401) {
        console.warn('Unauthorized request - Logging out...');
        
        // Agar aapka refresh token bhi expire ho gaya ya invalid hai
        // to yahan se logout call karein
        authService.logout(); 
      }

      return throwError(() => error);
    })
  );
};
