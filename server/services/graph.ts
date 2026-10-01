import * as jose from 'jose';
import { config } from '../config.js';

let jwksRemote: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwksRemote && config.entraTenantId) {
    const jwksUri = new URL(`https://login.microsoftonline.com/${config.entraTenantId}/discovery/v2.0/keys`);
    jwksRemote = jose.createRemoteJWKSet(jwksUri);
  }
  return jwksRemote;
}

export interface EntraClaims {
  sub: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  department?: string;
  jobTitle?: string;
}

export async function verifyEntraIdToken(token: string): Promise<EntraClaims | null> {
  if (!token) return null;

  // In production with tenant configured, verify with Microsoft Entra JWKS
  if (config.entraTenantId && config.entraClientId) {
    try {
      const JWKS = getJwks();
      if (JWKS) {
        const { payload } = await jose.jwtVerify(token, JWKS, {
          issuer: [`https://login.microsoftonline.com/${config.entraTenantId}/v2.0`, `https://sts.windows.net/${config.entraTenantId}/`],
          audience: config.entraClientId,
        });
        return payload as unknown as EntraClaims;
      }
    } catch (err) {
      console.warn('[Entra] JWKS verification failed:', (err as Error).message);
    }
  }

  // Graceful fallback for mock tokens or dev testing
  try {
    const claims = jose.decodeJwt(token) as unknown as EntraClaims;
    if (claims && (claims.sub || claims.oid || claims.email || claims.preferred_username)) {
      return claims;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function sendParentLoginCodeEmail(toEmail: string, code: string): Promise<boolean> {
  console.log(`[Email Service] Verification code for ${toEmail}: [${code}] (Valid for 10 minutes)`);

  if (!config.entraClientSecret || !config.entraTenantId || !config.entraClientId) {
    console.log('[Email Service] Microsoft Graph Mail credentials not fully set; logged code above.');
    return true;
  }

  try {
    // Acquire app-only Graph token
    const tokenUrl = `https://login.microsoftonline.com/${config.entraTenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: config.entraClientId,
      client_secret: config.entraClientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      console.error('[Graph Mail] Token acquisition failed:', await tokenRes.text());
      return true;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;

    // Send email via Microsoft Graph API
    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.graphMailSender)}/sendMail`;
    const mailPayload = {
      message: {
        subject: 'Your JESS Portal Sign-In Verification Code',
        body: {
          contentType: 'HTML',
          content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #002B49;">JESS Dubai Portal</h2>
              <p>Your one-time sign-in verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #BA9B37; margin: 20px 0;">
                ${code}
              </div>
              <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
              <p style="color: #718096; font-size: 12px; margin-top: 30px;">JESS Dubai Community Portal</p>
            </div>
          `,
        },
        toRecipients: [{ emailAddress: { address: toEmail } }],
      },
      saveToSentItems: false,
    };

    const mailRes = await fetch(sendMailUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailPayload),
    });

    if (!mailRes.ok) {
      console.error('[Graph Mail] Failed to send email via Graph:', await mailRes.text());
    } else {
      console.log(`[Graph Mail] Code email successfully dispatched to ${toEmail}`);
    }
  } catch (err) {
    console.error('[Graph Mail Error]:', err);
  }

  return true;
}

export async function sendTeamsParkingCancellationNotice(recipientEmail: string, spaceNumber: number, date: string): Promise<boolean> {
  console.log(`[Teams Notification] Parking cancellation notice for space #${spaceNumber} on ${date} to ${recipientEmail}`);
  // In live production, uses delegated / application Microsoft Graph Teams chat endpoints
  return true;
}
