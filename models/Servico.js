const sequelize = require("../conn");
const { DataTypes } = require('sequelize');
const Usuarios = require("./Usuarios");

const Servicos = sequelize.define('servicos', {
    idServico: {
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
    codigo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    codigoTributacao: {
        type: DataTypes.STRING,
        allowNull: true
    },
    discriminacao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cnae: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'servicos',
    timestamps: false
});

Usuarios.hasMany(Servicos, { foreignKey: 'idUsuario' });
Servicos.belongsTo(Usuarios, { foreignKey: 'idUsuario' });

module.exports = Servicos;
