import { LogLevel, PublicClientApplication, IPublicClientApplication } from '@azure/msal-browser';

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: '94e07c71-1694-417b-bedb-59a982205dc8',        // Overview page se copy karo
      authority: 'https://login.microsoftonline.com/common', // multi-tenant ke liye 'common'
      redirectUri: 'http://localhost:4200/auth-callback',    // dev ke liye; prod mein hr-cloud.online
      postLogoutRedirectUri: 'http://localhost:4200/login',
    },
    cache: {
      cacheLocation: 'localStorage'           // taake refresh pe session na ude
      //storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        logLevel: LogLevel.Warning,
      },
    },
  });
}