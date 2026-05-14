import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth'; 
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // 1. Pehle se saved Access Token ko nikalna
  const accessToken = localStorage.getItem('accessToken');
  
  // 2. Request clone karein (Cookies aur Authorization Header lagane ke liye)
  let clonedReq = req.clone({
    withCredentials: true
  });

  // Agar access token maujood hai to har normal request ke header me lagayein
  if (accessToken) {
    clonedReq = clonedReq.clone({
      headers: clonedReq.headers.set('Authorization', `Bearer ${accessToken}`)
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // Check karein ke request Auth (Login/Register/Refresh) URLs ki to nahi hai
      const isAuthUrl = req.url.includes('/login') || 
                        req.url.includes('/register') || 
                        req.url.includes('/refreshToken');

      // 🔄 Agar 401 error aata hai aur yeh normal request hai, to token refresh karein
      if (error.status === 401 && !isAuthUrl) {
        console.warn('Access token expired. Attempting automatic token refresh...');

        // Background me token refresh call chalayein
        return authService.tryRefreshToken().pipe(
          switchMap((res: any) => {
            if (res && res.accessToken) {
              console.log('Token refreshed successfully! Retrying original request...');
              
              // Naye access token ke sath original request ko dobara clone karke send karein
              const retryReq = req.clone({
                withCredentials: true,
                headers: req.headers.set('Authorization', `Bearer ${res.accessToken}`)
              });
              return next(retryReq);
            }
            
            // Agar backend se naya token nahi mila to session out
            authService.logout();
            return throwError(() => new Error('Session expired'));
          }),
          catchError((refreshError) => {
            // Agar token refresh ki API hi fail ho jaye (e.g., 7 days over), to logout kar dein
            console.error('Refresh token failed or expired. Logging out...', refreshError);
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      // Baqi tamam errors (400, 404, 500) ko normal pass hone dein
      return throwError(() => error);
    })
  );
};
