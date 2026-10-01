import dotenv from 'dotenv';
import type { config as SqlConfig } from 'mssql';
dotenv.config();

/**
 * Resolves the Azure SQL connection from (in priority order):
 *  1. AZURE_SQL_CONNECTION_STRING (documented App Service setting)
 *  2. SQL_CONNECTION_STRING (legacy name)
 *  3. SQLAZURECONNSTR_AZURE_SQL_CONNECTION_STRING (App Service "Connection strings" blade)
 *  4. AZURE_SQL_SERVER + AZURE_SQL_DATABASE + AZURE_SQL_USER + AZURE_SQL_PASSWORD
 */
function resolveSqlConnection(): string | SqlConfig | null {
  const connectionString =
    process.env.AZURE_SQL_CONNECTION_STRING ||
    process.env.SQL_CONNECTION_STRING ||
    process.env.SQLAZURECONNSTR_AZURE_SQL_CONNECTION_STRING;
  if (connectionString && connectionString.trim()) return connectionString.trim();

  const server = process.env.AZURE_SQL_SERVER?.trim();
  const database = process.env.AZURE_SQL_DATABASE?.trim();
  if (server && database) {
    const [host, portStr] = server.replace(/^tcp:/i, '').split(',');
    return {
      server: host,
      port: portStr ? parseInt(portStr, 10) : 1433,
      database,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };
  }
  return null;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  entraClientId: string;
  entraTenantId: string;
  entraClientSecret: string;
  graphMailSender: string;
  appHelpdeskEmail: string;
  sessionSecret: string;
  sqlConnection: string | SqlConfig | null;
  initialAdminEmails: string[];
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  entraClientId: process.env.ENTRA_CLIENT_ID || '',
  entraTenantId: process.env.ENTRA_TENANT_ID || '',
  entraClientSecret: process.env.ENTRA_CLIENT_SECRET || '',
  graphMailSender: process.env.GRAPH_MAIL_SENDER || 'portal-noreply@jess.sch.ae',
  appHelpdeskEmail: process.env.APP_HELPDESK_EMAIL || 'helpdesk@jess.sch.ae',
  sessionSecret: process.env.SESSION_SECRET || 'jess-portal-enterprise-secret-change-in-production-2026',
  sqlConnection: resolveSqlConnection(),
  // Staff emails automatically granted the Admin role on Entra sign-in, so a fresh
  // database always has at least one administrator.
  initialAdminEmails: (process.env.INITIAL_ADMIN_EMAILS || '')
    .split(/[,;]/)
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
};
