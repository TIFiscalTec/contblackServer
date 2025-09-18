// models/TermosDeUso.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');

const TermosDeUso = sequelize.define('termosDeUso', {
  idTermo: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  Versao: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Conteudo: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  DataCriacao: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'termosDeUso',
  timestamps: false
});

module.exports = TermosDeUso;