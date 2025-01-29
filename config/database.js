const { Sequelize } = require('sequelize');
const config = require('../config/config');

// Create Sequelize instance and connect to PostgreSQL
const sequelize = new Sequelize(config.development);

module.exports = sequelize;
