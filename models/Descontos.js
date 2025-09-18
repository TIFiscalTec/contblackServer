// models/Endereco.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');

const Descontos = sequelize.define('descontos', {
	idDesconto: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	discountCode: DataTypes.STRING,
	status: DataTypes.BOOLEAN,
	valorDesconto: DataTypes.DECIMAL(10, 2),
	duracaoMeses: {                       // Duração do desconto em meses
		type: DataTypes.INTEGER,
		defaultValue: 1
	},
}, {
	tableName: 'descontos',
	timestamps: true
});

module.exports = Descontos;
