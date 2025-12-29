import { provideAppInitializer ,ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// Sirf woh interceptor import karein jismein aapka logic hai (e.g., tokenInterceptor)
import { tokenInterceptor } from './token-interceptor'; 
import { AuthService } from './auth/auth'; // AuthService ka path verify karein
import { inject } from '@angular/core'; // inject function import karein
import { catchError, of } from 'rxjs'; // Yeh zaroori imports hain

const initializeApp = () => {
  const authService = inject(AuthService);
  return authService.tryRefreshToken().pipe(
    catchError(err => {
      console.error('Auth initialization failed:', err);
      // 'of(null)' return karne se initialization process rukega nahi
      return of(null); 
    })
  );
};


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([tokenInterceptor]) 
    ),
    // Naya tareeqa: provideAppInitializer function ko call karein
    provideAppInitializer(initializeApp) 
  ]
};