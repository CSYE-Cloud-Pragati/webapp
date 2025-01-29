const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); 

const HealthCheck = sequelize.define('HealthCheck', {
  check_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  datetime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = HealthCheck;
