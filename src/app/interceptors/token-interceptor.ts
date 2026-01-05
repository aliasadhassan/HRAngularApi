import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth'; 
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Observable, throwError, BehaviorSubject } from 'rxjs';

// Refreshing state manage karne ke liye variables
let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const tokenInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);

  // 1. URLs jo intercept nahi karni
  const bypassUrls = [
    '/login', 
    '/register', 
    '/refreshToken', 
    '/logout', 
    '/forgot-password',
    '/reset-password',
    '/api/auth/reset-password', // <-- Yeh line bhi add kar dein
    '/api/auth/forgot-password' // <-- Yeh bhi
  ];

  const shouldBypass = bypassUrls.some(url => req.url.includes(url));

  if (shouldBypass) {
    return next(req);
  }

  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  // 2. Agar accessToken hai to header lagayein
  if (accessToken) {
    req = addTokenHeader(req, accessToken);
  }
  
  return next(req).pipe(
    catchError((error) => {
      // 3. CHANGE: Sirf tab refresh karein agar 401 ho AUR dono tokens maujood hon
      if (error instanceof HttpErrorResponse && error.status === 401 && accessToken && refreshToken) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.tryRefreshToken().pipe(
      switchMap((tokenResponse: any) => {
        isRefreshing = false;
        
        // 4. CHANGE: Sirf accessToken check karein
        const newToken = tokenResponse?.accessToken;

        if (newToken) {
          refreshTokenSubject.next(newToken);
          return next(addTokenHeader(request, newToken));
        } else {
           authService.logout();
           return throwError(() => new Error('Session expired.'));
        }
      }),
      catchError((err: any) => {
        isRefreshing = false;
        authService.logout(); 
        return throwError(() => err);
      })
    );

  } else {
    return refreshTokenSubject.pipe(
      filter(accessToken => accessToken !== null),
      take(1),
      switchMap(accessToken => next(addTokenHeader(request, accessToken)))
    );
  }
}

// Helper function: Dono tokens (Access aur Refresh) headers mein add karne ke liye
function addTokenHeader(request: HttpRequest<any>, accessToken: string | null) {
  const refreshToken = localStorage.getItem('refreshToken');
  if (accessToken) {
    let updatedHeaders = request.headers.set('Authorization', `Bearer ${accessToken}`);
    if (refreshToken) {
      updatedHeaders = updatedHeaders.set('X-Refresh-Token', refreshToken);
    }
    return request.clone({
      headers: updatedHeaders
    });
  }
  
  return request;
}

