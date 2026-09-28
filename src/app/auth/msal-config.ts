import { LogLevel, PublicClientApplication, IPublicClientApplication } from '@azure/msal-browser';

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: '94e07c71-1694-417b-bedb-59a982205dc8',
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: 'http://localhost:4200/auth-callback',
      postLogoutRedirectUri: 'http://localhost:4200/login',
    },
    cache: {
      cacheLocation: 'localStorage'
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        logLevel: LogLevel.Warning,
      },
    },
  });
}