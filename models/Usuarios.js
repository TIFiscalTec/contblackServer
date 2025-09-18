const { DataTypes } = require('sequelize');
const sequelize = require('../conn');

const Usuarios = sequelize.define('usuarios', {
    idUsuario: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    Nome: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    TipoPessoa: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Cpf: DataTypes.STRING,
    Cnpj: DataTypes.STRING,
    RazaoSocial: DataTypes.STRING,
    Telefone: DataTypes.STRING,
    Senha: {
        type: DataTypes.STRING,
        allowNull: false
    },
    idAsaas: {
        type: DataTypes.STRING,
        allowNull: false
    },
    FirstTime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    TokenZapSign: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'usuarios',
    timestamps: false
});

module.exports = Usuarios;
