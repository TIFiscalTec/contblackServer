// models/Consentimento.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');
const TermosDeUso = require('./TermosDeUso');

const Consentimentos = sequelize.define('consentimentos', {
  idConsentimento: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  DataConcordancia: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Revogado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  DataRevogacao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  idUsuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Usuarios,
        key: "idUsuario",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
}, {
  tableName: 'consentimentos',
  timestamps: false
});

// Relacionamentos
Consentimentos.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(Consentimentos, { foreignKey: 'idUsuario' });

Consentimentos.belongsTo(TermosDeUso, { foreignKey: 'idTermo' });
TermosDeUso.hasMany(Consentimentos, { foreignKey: 'idTermo' });

module.exports = Consentimentos;
