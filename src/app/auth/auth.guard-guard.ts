import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth';

export const authGuardGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return authService.refreshAccessToken().pipe(
    map(() => true),
    catchError(() => {
      localStorage.removeItem('accessToken');
      return of(router.createUrlTree(['/login']));
    })
  );
};