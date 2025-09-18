// models/Planos.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn'); // importa sua conexão Sequelize

const Planos = sequelize.define('planos', {
    idPlano: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    valorAntigoMensal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    valorNovoMensal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    valorAntigoAnual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    valorNovoAnual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    descontoMensal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    descontoAnual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'planos',
    timestamps: true // cria automaticamente createdAt e updatedAt
});

module.exports = Planos;
