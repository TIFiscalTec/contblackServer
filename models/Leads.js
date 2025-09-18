// models/Lead.js
const { DataTypes } = require("sequelize");
const sequelize = require("../conn");

const Lead = sequelize.define("leads", {
    idLead: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    nome: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    telefone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    cpf: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    cnpj: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    razaoSocial: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    stepAtual: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
}, {
    tableName: 'leads',
    timestamps: false
});


module.exports = Lead;
