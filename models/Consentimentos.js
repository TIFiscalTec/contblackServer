// models/Consentimento.js
const { DataTypes } = require('sequelize');
const sequelize = require('../conn');
const Usuarios = require('./Usuarios');
const TermosDeUso = require('./TermosDeUso');
const PoliticaDePrivacidade = require('./PoliticaDePrivacidade');

const Consentimentos = sequelize.define('consentimentos', {
	idConsentimento: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	DataConcordancia: {
		type: DataTypes.DATE,
		defaultValue: DataTypes.NOW
	},
	Revogado: {
		type: DataTypes.BOOLEAN,
		defaultValue: false
	},
	DataRevogacao: {
		type: DataTypes.DATE,
		allowNull: true
	},
}, {
	tableName: 'consentimentos',
	timestamps: false
});

// Relacionamentos
Consentimentos.belongsTo(Usuarios, { foreignKey: 'idUsuario' });
Usuarios.hasMany(Consentimentos, { foreignKey: 'idUsuario' });

Consentimentos.belongsTo(TermosDeUso, { foreignKey: 'idTermo' });
TermosDeUso.hasMany(Consentimentos, { foreignKey: 'idTermo' });

Consentimentos.belongsTo(PoliticaDePrivacidade, { foreignKey: 'idPolitica' });
PoliticaDePrivacidade.hasMany(Consentimentos, { foreignKey: 'idPolitica' });

module.exports = Consentimentos;
