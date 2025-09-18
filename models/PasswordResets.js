const { DataTypes } = require("sequelize");
const sequelize = require("../conn");
const Usuarios = require("./Usuarios");

const PasswordResets = sequelize.define("passwordResets", {
    idPasswordReset: {
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
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: 'passwordResets',
    timestamps: true,
});

module.exports = PasswordResets;
