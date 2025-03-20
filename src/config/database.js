const { Sequelize } = require('sequelize');
require('dotenv').config();

// Determine if we are in the test environment
const isTestEnv = process.env.NODE_ENV === 'test';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    dialectOptions: isTestEnv
      ? {} 
      : {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
    logging: false,
  }
);

module.exports = sequelize;
