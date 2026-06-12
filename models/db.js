// const mysql = require("mysql2/promise");

// const db = mysql.createPool({
//   uri: process.env.MYSQL_URL
// });

// module.exports = db;




// Online
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE
});

// //Produção
// const mysql = require('mysql2/promise');
// require('dotenv').config();

// const db = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT || 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// console.log('✅ MySQL conectado!');

module.exports = db;





// Conexão local

// const db = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
// //   uri: process.env.MYSQL_URL,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0

// });

// module.exports = db;