import { provideAppInitializer, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token-interceptor'; // Apna token interceptor import karein
import { AuthService } from './auth/auth'; 
import { inject } from '@angular/core'; 
import { catchError, of } from 'rxjs'; 
import { loaderInterceptor } from './interceptors/loader-interceptor'; // Loader interceptor import karein

// Application start hotay hi check karega ke session valid hai ya nahi
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
      withInterceptors([tokenInterceptor, loaderInterceptor]),
      // *** YEH WALA CODE ZAROORI THA ***
      // Ye setting ensure karti hai ke har cross-origin request ke sath
      // browser automatically 'refreshToken' cookie bhejega.
      withXsrfConfiguration({}) 
      // withXsrfConfiguration use karne se automatically `withCredentials: true` enable ho jata hai 
      // aur browser cookie bhej deta hai.
    ),
    // Naya tareeqa: provideAppInitializer function ko call karein
    provideAppInitializer(initializeApp) 
  ]
};
