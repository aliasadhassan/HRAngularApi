import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth'; // Aapki actual authentication service
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const authGuardGuard: CanActivateFn = (route, state) => {
 const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Pehle check karein kya token valid hai
  if (authService.isAuthenticated()) {
    return true;
  }

  // 2. Agar token expire ho chuka hai, toh refresh ki koshish karein
  return authService.tryRefreshToken().pipe(
    map(res => {
      if (res && res.token) {
        // Naya token mil gaya, access allow karein
        return true; 
      } else {
        // Refresh fail hua, login par bhein
        router.navigate(['/login']);
        return false;
      }
    }),
    catchError(() => {
      // Error ki surat mein bhi logout/login redirect
      router.navigate(['/login']);
      return of(false);
    })
  );
};