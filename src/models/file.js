const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const File = sequelize.define("File", {
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  upload_date: {
    type: DataTypes.DATEONLY, 
    allowNull: false,
  },
}, {
  timestamps: false, 
  tableName: "files", 
});

module.exports = File;
