// models/Assinaturas.js
const { DataTypes } = require("sequelize");
const sequelize = require("../conn"); // sua conexão Sequelize
const Usuarios = require("./Usuarios");
const Planos = require("./Planos");

const Assinaturas = sequelize.define(
  "assinaturas",
  {
    idAssinatura: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    idPlano: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Planos,
        key: "idPlano",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    idAssinaturaAsaas: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    idAsaas: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    periodicidade: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "MENSAL",
    },
    dataInicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    dataFim: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    proximaCobranca: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ultimaCobranca: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metodoPagamento: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "BOLETO"
    },
  },
  {
    tableName: "assinaturas",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// 🔗 Relacionamentos
Assinaturas.belongsTo(Usuarios, { foreignKey: "idUsuario" });
Assinaturas.belongsTo(Planos, { foreignKey: "idPlano" });

module.exports = Assinaturas;
