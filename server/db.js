// =====================================================================
// Conexão com o MySQL (pool de conexões do driver mysql2)
// Os dados de acesso ficam no arquivo .env, na raiz do projeto.
// =====================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'grao_da_serra',
  charset: 'utf8mb4',
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL chega como número (e não como texto)
  dateStrings: true     // DATETIME chega como texto, sem conversão de fuso
});

module.exports = pool;
