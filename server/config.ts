import dotenv from 'dotenv';
dotenv.config();

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
  sqlConnectionString: string;
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
  sqlConnectionString: process.env.SQL_CONNECTION_STRING || '',
};
