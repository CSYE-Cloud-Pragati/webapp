const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); 

const HealthCheck = sequelize.define('HealthCheck', {
  check_id: {
    type: DataTypes.INTEGER,  
    primaryKey: true,
    autoIncrement: true,  
    allowNull: false,
  },
  datetime: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'), // Use CURRENT_TIMESTAMP without AT TIME ZONE
  },
}, {
  timestamps: false  
});

module.exports = HealthCheck;
