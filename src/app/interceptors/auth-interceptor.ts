import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth'; // Path set ho gaya
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  
  const authService = inject(AuthService); // Service inject karein

  // Request ko clone karein (Headers aur Cookies ke liye)
  const authReq = req.clone({
    withCredentials: true 
  });

return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // *** YEH CONDITION ADD KAREIN ***
      // Sirf un errors par logout karein jo login ya register API se nahi aa rahin
      const isAuthUrl = req.url.includes('/login') || req.url.includes('/register');

      if (error.status === 401 && !isAuthUrl) { // Condition change hui
        console.warn('Unauthorized request - Logging out...');
        authService.logout(); 
      }

      return throwError(() => error);
    })
  );
};
