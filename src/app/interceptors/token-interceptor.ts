import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth'; 
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Observable, throwError, BehaviorSubject } from 'rxjs';

// Multiple requests queue ko manage karne ke liye variables
let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const tokenInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);

  // 1. URLs jo intercept nahi karni (Bypass List)
  const bypassUrls = [
    '/login', 
    '/register', 
    '/refreshToken', 
    '/logout', 
    '/forgot-password',
    '/reset-password',
    '/api/auth/reset-password', 
    '/api/auth/forgot-password' 
  ];

  const shouldBypass = bypassUrls.some(url => req.url.includes(url));

  if (shouldBypass) {
    // ✅ Auth URLs ko simple pass hone dein lekin cookies update karne ke liye withCredentials lazmi lagayein
    return next(req.clone({ withCredentials: true }));
  }

  const accessToken = localStorage.getItem('accessToken');

  // 2. Normal requests ko clone karein, withCredentials enable karein aur header lagayein
  let authReq = req.clone({ withCredentials: true });
  if (accessToken) {
    authReq = addTokenHeader(authReq, accessToken);
  }
  
  return next(authReq).pipe(
    catchError((error) => {
      // 3. ✅ CHANGE: Refresh Token local storage se check karne ki zaroori nahi, wo secure cookie me hai. 
      // Sirf check karein agar error 401 hai aur access token pehle se maujood tha.
      if (error instanceof HttpErrorResponse && error.status === 401 && accessToken) {
        return handle401Error(authReq, next, authService);
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
    // Agar pehle se koi request token refresh karwa rahi hai, to baqi saari requests yahan wait kareingi
    return refreshTokenSubject.pipe(
      filter(accessToken => accessToken !== null),
      take(1),
      switchMap(accessToken => next(addTokenHeader(request, accessToken!)))
    );
  }
}

// ✅ Helper function updated: Refresh Token ka saara header logic delete kar diya hai, ab sirf Access Token header me jayega
function addTokenHeader(request: HttpRequest<any>, accessToken: string | null) {
  if (accessToken) {
    return request.clone({
      withCredentials: true, // Browser automatic backend ko cookie send karega
      headers: request.headers.set('Authorization', `Bearer ${accessToken}`)
    });
  }
  return request;
}
