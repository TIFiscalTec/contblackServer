// models/Endereco.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');

const Enderecos = sequelize.define('enderecos', {
  idEndereco: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  Cep: DataTypes.STRING,
  Estado: DataTypes.STRING,
  Cidade: DataTypes.STRING,
  Bairro: DataTypes.STRING,
  Endereco: DataTypes.STRING,
  Numero: DataTypes.STRING,
  Complemento: DataTypes.STRING,
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
  tableName: 'enderecos',
  timestamps: false
});

// Relacionamento
Enderecos.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(Enderecos, { foreignKey: 'idUsuario' });

module.exports = Enderecos;
