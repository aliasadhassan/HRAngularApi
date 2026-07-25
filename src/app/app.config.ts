import { provideAppInitializer, ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token-interceptor';
import { AuthService } from './auth/auth';
import { inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { loaderInterceptor } from './interceptors/loader-interceptor';
import {
  MsalModule,
  MsalService,
  MsalGuard,
  MsalBroadcastService,
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalGuardConfiguration,
  MsalInterceptorConfiguration
} from '@azure/msal-angular';
import { InteractionType } from '@azure/msal-browser';
import { MSALInstanceFactory } from './auth/msal-config';

const initializeApp = () => {
  const authService = inject(AuthService);
  return authService.tryRefreshToken().pipe(
    catchError(err => {
      console.error('Auth initialization failed:', err);
      return of(null);
    })
  );
};

const guardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Popup,
  authRequest: { scopes: ['user.read'] }
};

const interceptorConfig: MsalInterceptorConfiguration = {
  interactionType: InteractionType.Popup,
  protectedResourceMap: new Map()
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([tokenInterceptor, loaderInterceptor]),
      withXsrfConfiguration({})
    ),
    provideAppInitializer(initializeApp),

    importProvidersFrom(MsalModule),
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory,
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useValue: guardConfig,
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useValue: interceptorConfig,
    },
    MsalService,
    MsalGuard,
    MsalBroadcastService,
  ]
};