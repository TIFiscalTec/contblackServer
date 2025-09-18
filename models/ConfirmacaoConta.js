const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuario = require('./Usuarios');

const ConfirmacaoConta = sequelize.define('confirmacaoConta', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  codigo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiraEm: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  tableName: 'confirmacaoConta',
  timestamps: false
});


module.exports = ConfirmacaoConta;
