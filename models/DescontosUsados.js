// models/Endereco.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');
const Descontos = require('./Descontos')

const DescontosUsados = sequelize.define('descontosUsados', {
  idDescontoUsado: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
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
  tableName: 'descontosUsados',
  timestamps: true
});

// Relacionamento
DescontosUsados.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(DescontosUsados, { foreignKey: 'idUsuario' });
DescontosUsados.belongsTo(Descontos, { foreignKey: 'idDesconto' });
Descontos.hasMany(DescontosUsados, { foreignKey: 'idDesconto' });

module.exports = DescontosUsados;
