const sequelize = require("../conn");
const { DataTypes } = require('sequelize');
const Usuarios = require("./Usuarios");

const Certificados = sequelize.define('certificados', {
    idCertificado: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Usuarios,
            key: 'idUsuario'
        },
        onDelete: 'CASCADE'
    },
    idCertificadoPlugNotas: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    arquivoNome: {
        type: DataTypes.STRING,
        allowNull: false,
    }
});

Usuarios.hasMany(Certificados, { foreignKey: 'idUsuario' });
Certificados.belongsTo(Usuarios, { foreignKey: 'idUsuario' });

module.exports = Certificados;