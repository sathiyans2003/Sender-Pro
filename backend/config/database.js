const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const isMySQL = process.env.DB_DIALECT === 'mysql';

const sequelize = new Sequelize(
    process.env.DB_NAME || 'sender_pro',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: isMySQL ? 'mysql' : 'sqlite',
        storage: isMySQL ? undefined : path.join(__dirname, '..', 'sender_pro.sqlite'),
        logging: false,
    }
);

module.exports = sequelize;
