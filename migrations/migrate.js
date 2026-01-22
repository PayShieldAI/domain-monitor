const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};
console.log('ENV LOADED:', {
  DB_HOST: process.env.DB_USER,
  ENV_FILE: process.cwd()
});

async function migrate() {
  let connection;

  try {
    console.log('Connecting to database...');
    console.log(`Host: ${config.host}`);
    console.log(`Database: ${config.database}`);

    connection = await mysql.createConnection(config);
    console.log('Connected successfully.\n');

    // Create migrations tracking table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const [executed] = await connection.execute('SELECT name FROM migrations');
    const executedNames = new Set(executed.map(r => r.name));

    // Get migration files
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    let migrationsRun = 0;

    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`Skip: ${file} (already executed)`);
        continue;
      }

      console.log(`Running: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await connection.query(sql);
        await connection.execute('INSERT INTO migrations (name) VALUES (?)', [file]);
        console.log(`Done: ${file}\n`);
        migrationsRun++;
      } catch (err) {
        console.error(`Failed: ${file}`);
        console.error(`Error: ${err.message}`);
        throw err;
      }
    }

    if (migrationsRun === 0) {
      console.log('\nAll migrations already executed.');
    } else {
      console.log(`\n${migrationsRun} migration(s) completed successfully.`);
    }

  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run migrations
migrate();
