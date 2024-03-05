const mysql2 = require('mysql2/promise');

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    namedPlaceholders: true
};

var database = mysql2.createPool(dbConfig);

module.exports = database;