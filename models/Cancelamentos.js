const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');

const Cancelamentos = sequelize.define('cancelamentos', {
    idCancelamento: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    motivosSelecionados: {
        type: DataTypes.JSON,
        allowNull: true
    },
    outroMotivo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dataCancelamento: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    idUsuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Usuarios,
            key: 'idUsuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    }
}, {
    tableName: 'cancelamentos',
    timestamps: false
});

// Relacionamento com Usuarios
Cancelamentos.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(Cancelamentos, { foreignKey: 'idUsuario' });

module.exports = Cancelamentos;
