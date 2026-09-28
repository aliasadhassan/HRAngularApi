import { HttpInterceptorFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth';

const BYPASS_URLS = [
  '/login',
  '/register',
  '/refreshToken',
  '/logout',
  '/forgot-password',
  '/reset-password',
  '/sso/callback'
];

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (BYPASS_URLS.some(url => req.url.includes(url))) {
    return next(req.clone({ withCredentials: true }));
  }

  const accessToken = localStorage.getItem('accessToken');

  return next(withAuth(req, accessToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        catchError(refreshError => {
          authService.endSession();
          return throwError(() => refreshError);
        }),
        switchMap(newToken => next(withAuth(req, newToken)))
      );
    })
  );
};

function withAuth(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {}
  });
}