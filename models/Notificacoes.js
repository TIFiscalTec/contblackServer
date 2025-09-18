// models/Endereco.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');

const Notificacoes = sequelize.define('notificacoes', {
  idNotificacao: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  titulo: DataTypes.STRING,
  descricao: DataTypes.STRING,
  data: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
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
  tableName: 'notificacoes',
  timestamps: false
});

// Relacionamento
Notificacoes.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(Notificacoes, { foreignKey: 'idUsuario' });

module.exports = Notificacoes;
