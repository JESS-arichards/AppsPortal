/**
 * Empties the portal database and rebuilds it from database/schema.sql.
 * Usage: npm run db:reset   (refuses to run when NODE_ENV=production)
 */
import sql from 'mssql';
import { config } from '../server/config.js';
import { runSqlScript } from '../server/db/index.js';

async function main(): Promise<void> {
  if (config.isProduction) {
    throw new Error('db:reset is disabled when NODE_ENV=production.');
  }
  if (!config.sqlConnection) {
    throw new Error('No SQL connection configured (set AZURE_SQL_CONNECTION_STRING or AZURE_SQL_SERVER/DATABASE/USER/PASSWORD).');
  }

  const pool = await new sql.ConnectionPool(config.sqlConnection as any).connect();
  try {
    const target = (await pool.request().query('SELECT @@SERVERNAME AS server, DB_NAME() AS db')).recordset[0];
    console.log(`[db:reset] Dropping all portal tables in ${target.db} on ${target.server}...`);
    if (!(await runSqlScript(pool, 'reset.sql'))) throw new Error('database/reset.sql not found');
    console.log('[db:reset] Rebuilding schema from database/schema.sql...');
    if (!(await runSqlScript(pool, 'schema.sql'))) throw new Error('database/schema.sql not found');
    console.log('[db:reset] Done. The database is empty apart from default branding and content.');
  } finally {
    await pool.close();
  }
}

main().catch(err => {
  console.error('[db:reset] Failed:', err.message || err);
  process.exit(1);
});
