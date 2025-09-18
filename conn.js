// db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(`${process.env.DB_NAME}`, `${process.env.DB_USER}`, `${process.env.DB_PASS}`, {
  host: `${process.env.DB_HOST}`,
  dialect: 'mysql',
  logging: false, // opcional: tira os logs SQL do terminal
});

module.exports = sequelize;
