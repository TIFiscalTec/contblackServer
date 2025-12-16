// models/NotasFiscais.js
const { DataTypes } = require("sequelize");
const sequelize = require("../conn");
const Assinaturas = require("./Assinaturas");
const Usuarios = require("./Usuarios");

const NotasFiscais = sequelize.define(
  "notasFiscais",
  {
    idNota: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    idIntegracao: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
    idAssinatura: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Assinaturas,
        key: "idAssinatura",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    emitidaPor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Usuarios,
        key: "idUsuario",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    numeroNota: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    dataEmissao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    dadosNFSe: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    caminhoXML: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    caminhoPDF: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "notasFiscais",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// 🔗 Relacionamentos
NotasFiscais.belongsTo(Usuarios, { foreignKey: "idUsuario", as: "usuario" });
NotasFiscais.belongsTo(Usuarios, { foreignKey: "emitidaPor", as: "emissor" });
NotasFiscais.belongsTo(Assinaturas, { foreignKey: "idAssinatura", as: "assinatura" });

module.exports = NotasFiscais;
