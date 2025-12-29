import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth/auth'; 
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Observable, throwError, BehaviorSubject } from 'rxjs';

// Refreshing state manage karne ke liye variables
let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const tokenInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);

  // 1. Agar request login ya register ki hai, to token add na karein aur na hi error handle karein
  if (req.url.includes('/login') || req.url.includes('/register') || req.url.includes('/refreshToken')) {
    return next(req);
  }

  // 2. Baaqi requests mein token add karein agar user authenticated hai
  const token = localStorage.getItem('accessToken');
  if (token) {
    req = addTokenHeader(req, token);
  }
  
  return next(req).pipe(
    catchError((error) => {
      // 3. Sirf 401 Unauthorized par handle karein, lekin login calls par nahi (uproar exclude ho chuki hain)
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

// Helper function: Token header mein add karne ke liye
function addTokenHeader(request: HttpRequest<any>, token: string | null) {
  if (token) {
    return request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`)
    });
  }
  return request;
}

// Helper function: 401 error aur Refresh Token handle karne ke liye
function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.tryRefreshToken().pipe(
      switchMap((tokenResponse: any) => {
        isRefreshing = false;
        
        // Backend response structure ke mutabiq check karein (e.g., tokenResponse.token)
        const newToken = tokenResponse?.token;

        if (newToken) {
           refreshTokenSubject.next(newToken);
           return next(addTokenHeader(request, newToken));
        } else {
           // Agar naya token nahi mila, to hi logout karein
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
    // Agar refresh pehle se chal raha hai, to baaqi requests wait karein
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next(addTokenHeader(request, token)))
    );
  }
}
