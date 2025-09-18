const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');

const Admins = sequelize.define('admins', {
    idAdmin: {
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
    Nivel: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }
}, {
    tableName: 'admins',
    timestamps: false
});

// relacionamento
Usuarios.hasOne(Admins, { foreignKey: 'idUsuario' });
Admins.belongsTo(Usuarios, { foreignKey: 'idUsuario' });

module.exports = Admins;
