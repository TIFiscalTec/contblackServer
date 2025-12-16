const sequelize = require("../conn");
const { DataTypes } = require('sequelize');
const Usuarios = require("./Usuarios");

const Empresas = sequelize.define('empresas', {
    idEmpresa: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    idUsuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Usuarios,
            key: 'idUsuario'
        }
    },
    cnpj: {
        type: DataTypes.STRING,
        allowNull: false
    },
    inscricaoEstadual: {
        type: DataTypes.STRING,
        allowNull: false
    },
    inscricaoMunicipal: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    razaoSocial: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nomeFantasia: {
        type: DataTypes.STRING,
        allowNull: false
    },
    certificado: {
        type: DataTypes.STRING,
        allowNull: false
    },
    simplesNacional: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    regimeTributario: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    incentivoFiscal: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    incentivadorCultural: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    regimeTributarioEspecial: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cep: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipoLogradouro: {
        type: DataTypes.STRING,
        allowNull: false
    },
    logradouro: {
        type: DataTypes.STRING,
        allowNull: false
    },
    numero: {
        type: DataTypes.STRING,
        allowNull: false
    },
    estado: {
        type: DataTypes.STRING,
        allowNull: false
    },
    cidade: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bairro: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    telefone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    gerarFaturas: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
}, {
    tableName: 'empresas',
    timestamps: false
});

Usuarios.hasOne(Empresas, { foreignKey: 'idUsuario' });
Empresas.belongsTo(Usuarios, { foreignKey: 'idUsuario' });

module.exports = Empresas;
