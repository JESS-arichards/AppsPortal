import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.SQL_CONNECTION_STRING;
  if (!connectionString) {
    console.log('[Migration] No SQL_CONNECTION_STRING provided. Skipping live Azure SQL migration (memory store is initialized automatically).');
    return;
  }

  console.log('[Migration] Connecting to Azure SQL...');
  const pool = new sql.ConnectionPool(connectionString);
  await pool.connect();
  console.log('[Migration] Connected to database.');

  // Create migration history table if not exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '__SchemaMigrations')
    BEGIN
        CREATE TABLE __SchemaMigrations (
            migrationName NVARCHAR(255) PRIMARY KEY,
            appliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END;
  `);

  // Prefer consolidated schema.sql if present, otherwise iterate migrations/ directory
  const consolidatedSchemaPath = path.join(__dirname, 'schema.sql');
  const migrationsDir = path.join(__dirname, 'migrations');

  if (fs.existsSync(consolidatedSchemaPath)) {
    const schemaFile = 'schema.sql';
    const check = await pool.request()
      .input('name', sql.NVarChar, schemaFile)
      .query('SELECT migrationName FROM __SchemaMigrations WHERE migrationName = @name');

    if (check.recordset.length === 0) {
      console.log(`[Migration] Applying consolidated schema from ${schemaFile}...`);
      const sqlContent = fs.readFileSync(consolidatedSchemaPath, 'utf8');
      const batches = sqlContent.split(/^\s*GO\s*$/mi);
      for (const batch of batches) {
        const trimmed = batch.trim();
        if (trimmed) {
          await pool.request().batch(trimmed);
        }
      }
      await pool.request()
        .input('name', sql.NVarChar, schemaFile)
        .query('INSERT INTO __SchemaMigrations (migrationName) VALUES (@name)');
      console.log(`[Migration] Successfully applied consolidated schema: ${schemaFile}`);
    } else {
      console.log(`[Migration] Consolidated schema already applied: ${schemaFile}`);
    }
  } else if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const check = await pool.request()
        .input('name', sql.NVarChar, file)
        .query('SELECT migrationName FROM __SchemaMigrations WHERE migrationName = @name');

      if (check.recordset.length === 0) {
        console.log(`[Migration] Applying ${file}...`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Split batches on GO if present
        const batches = sqlContent.split(/^\s*GO\s*$/mi);
        for (const batch of batches) {
          const trimmed = batch.trim();
          if (trimmed) {
            await pool.request().batch(trimmed);
          }
        }

        await pool.request()
          .input('name', sql.NVarChar, file)
          .query('INSERT INTO __SchemaMigrations (migrationName) VALUES (@name)');

        console.log(`[Migration] Successfully applied ${file}`);
      } else {
        console.log(`[Migration] Already applied: ${file}`);
      }
    }
  }

  await pool.close();
  console.log('[Migration] All migrations completed successfully.');
}

runMigrations().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
