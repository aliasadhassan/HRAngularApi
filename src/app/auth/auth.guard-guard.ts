import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth';

export const authGuardGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Access token abhi valid hai
  if (authService.isAuthenticated()) {
    return true;
  }

  // 2. Expire ho chuka / maujood nahi -> cookie se refresh try karo
  return authService.refreshAccessToken().pipe(
    map(() => true),
    catchError(() => {
      localStorage.removeItem('accessToken');
      return of(router.createUrlTree(['/login']));
    })
  );
};