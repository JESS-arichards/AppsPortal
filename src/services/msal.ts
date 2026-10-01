import { PublicClientApplication, Configuration, RedirectRequest } from '@azure/msal-browser';

declare global {
  interface Window {
    PORTAL_CONFIG?: {
      ENTRA_CLIENT_ID: string;
      ENTRA_TENANT_ID: string;
      APP_HELPDESK_EMAIL: string;
    };
  }
}

let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication | null {
  if (msalInstance) return msalInstance;

  const clientId = window.PORTAL_CONFIG?.ENTRA_CLIENT_ID;
  const tenantId = window.PORTAL_CONFIG?.ENTRA_TENANT_ID;

  if (!clientId || !tenantId) {
    return null;
  }

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  };

  msalInstance = new PublicClientApplication(msalConfig);
  return msalInstance;
}

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

export async function loginWithEntraRedirect(): Promise<void> {
  const instance = getMsalInstance();
  if (!instance) {
    throw new Error('Entra ID authentication is not configured on this environment (missing ENTRA_CLIENT_ID / ENTRA_TENANT_ID).');
  }

  await instance.initialize();
  await instance.loginRedirect(loginRequest);
}

export async function handleMsalRedirect(): Promise<string | null> {
  const instance = getMsalInstance();
  if (!instance) return null;

  await instance.initialize();
  const response = await instance.handleRedirectPromise();
  if (response && response.idToken) {
    return response.idToken;
  }
  return null;
}

export async function logoutEntra(): Promise<void> {
  const instance = getMsalInstance();
  if (instance) {
    await instance.initialize();
    await instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  } else {
    window.location.href = '/';
  }
}
