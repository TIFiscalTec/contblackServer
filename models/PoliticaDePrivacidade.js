
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');

const PoliticaDePrivacidade = sequelize.define('politicaDePrivacidade', {
  idPolitica: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  Versao: {
    type: DataTypes.INTEGER,
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
  tableName: 'politicaDePrivacidade',
  timestamps: false
});

module.exports = PoliticaDePrivacidade;