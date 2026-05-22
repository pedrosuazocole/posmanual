/**
 * POSManual - DevSys Honduras
 * Script de migración automática
 * Archivo: server/src/db/migrate.js
 *
 * Ejecutar con: npm run migrate
 * Railway puede correrlo como "Release Command" antes del deploy.
 *
 * Lee 01_schema.sql y lo ejecuta en la base de datos conectada.
 * Usa CREATE TABLE IF NOT EXISTS → es idempotente (seguro de re-ejecutar).
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const schemaPath = path.join(__dirname, '../../../01_schema.sql');
  const seedPath   = path.join(__dirname, '../../../02_seed.sql');

  console.log('🔄 Iniciando migración POSManual...');

  const client = await pool.connect();
  try {
    // Leer y ejecutar schema
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
      console.log('✅ Schema aplicado correctamente');
    } else {
      console.warn('⚠️  01_schema.sql no encontrado en', schemaPath);
    }

    // Verificar si ya hay datos antes de ejecutar seed
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM usuarios');
    if (+count === 0 && fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await client.query(seed);
      console.log('✅ Seed ejecutado (usuarios y grupos iniciales creados)');
    } else {
      console.log(`ℹ️  Seed omitido (ya existen ${count} usuarios)`);
    }

    console.log('🎉 Migración completada exitosamente');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
