import { provideAppInitializer, ApplicationConfig, importProvidersFrom, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token-interceptor';
import { AuthService } from './auth/auth';
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
import { InteractionType, IPublicClientApplication } from '@azure/msal-browser';
import { MSALInstanceFactory } from './auth/msal-config';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './core/i18n/language.service';
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeZh from '@angular/common/locales/zh';
import localeTr from '@angular/common/locales/tr';

// Date/number pipes ke liye locale data (warna 'ar'/'zh'/'tr' pe pipe error deta hai)
registerLocaleData(localeAr);
registerLocaleData(localeZh);
registerLocaleData(localeTr);

const initializeApp = () => {
  const authService = inject(AuthService);
  return authService.refreshAccessToken().pipe(
    catchError(err => {
      console.error('Auth initialization failed:', err);
      return of(null);
    })
  );
};

const guardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect,
  authRequest: { scopes: ['user.read'] }
};

const interceptorConfig: MsalInterceptorConfiguration = {
  interactionType: InteractionType.Redirect,
  protectedResourceMap: new Map()
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([tokenInterceptor, loaderInterceptor]),
      withXsrfConfiguration({})
    ),

    provideTranslateService({
      fallbackLang: 'en',
        loader: provideTranslateHttpLoader({
        prefix: './i18n/',
        suffix: '.json',
        useHttpBackend: true
      })
    }),

    // Pehla screen draw hone se pehle translations load — English/Arabic ka flash nahi
    provideAppInitializer(() => inject(LanguageService).init()),

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

    provideAppInitializer(() => {
      const msalInstance = inject(MSAL_INSTANCE) as IPublicClientApplication;
      return msalInstance.initialize();
    }),

    provideAppInitializer(initializeApp),
  ]
};