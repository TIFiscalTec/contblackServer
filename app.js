
const express = require('express');
const bcrypt = require('bcrypt');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const sendEmail = require('./utils/SendEmail');
const axios = require('axios');
const { Op } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
require('dotenv').config();


// const util = require('util');
// const currentDate = new Date().toISOString().slice(0, 19);
// const log_file = fs.createWriteStream(__dirname + '/log/debug_' + currentDate + '.log', { flags: 'w' });
// const log_stdout = process.stdout;
// console.log = function (d) { //
// 	log_file.write(util.format(d) + '\n');
// 	log_stdout.write(util.format(d) + '\n');
// };

const app = express();
const PORT = 3001;

// Models
const sequelize = require('./conn');
const Usuario = require('./models/Usuarios');
const Endereco = require('./models/Enderecos');
const TermosDeUso = require('./models/TermosDeUso');
const Consentimento = require('./models/Consentimentos');
const ConfirmacaoConta = require('./models/ConfirmacaoConta');
const Planos = require("./models/Planos");
const Assinaturas = require("./models/Assinaturas");
const Notificacoes = require("./models/Notificacoes");
const DescontosUsados = require("./models/DescontosUsados");
const Descontos = require('./models/Descontos');
const Admins = require('./models/Admins');
const PasswordResets = require("./models/PasswordResets");
const Lead = require('./models/Leads');
const Cancelamentos = require('./models/Cancelamentos');

app.use(express.json());
app.use(cors({
	origin: "*",
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const server = http.createServer(app);

const autenticarToken = (req, res, next) => {
	const token = req.headers['authorization'];
	if (!token) return res.send({ status: 400, mensagem: 'Token não fornecido.' });

	jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
		if (err) return res.send({ status: 400, mensagem: 'Token inválido.' });
		req.usuario = usuario;
		next();
	});
};

app.get('/', async (req, res) => {
	res.send("up")
});

app.get("/getUserByEmail/:email", autenticarToken, async (req, res) => {
	console.log(`[START] GET /getUserByEmail/:email - params:`, req.params, '- query:', req.query);
	const { email } = req.params;

	const usuario = await Usuario.findOne({ where: { Email: email }, attributes: ['idUsuario', 'Nome', 'Email', 'TipoPessoa', 'Cpf', 'Cnpj', 'RazaoSocial', 'Telefone'] });
	if (!usuario) {
		console.log(`[END] GET /getUserByEmail/:email - Usuário não encontrado.`);
		return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });
	}
	res.send({ status: 200, usuario });
	console.log(`[END] GET /getUserByEmail/:email`);
});

app.post("/recuperarSenha", async (req, res) => {
	console.log(`[START] POST /recuperarSenha - body:`, req.body);
	try {
		const { email } = req.body;

		const user = await Usuario.findOne({ where: { Email: email } });

		if (!user) {
			console.log(`[END] POST /recuperarSenha - Usuário não encontrado.`);
			return res.send({ status: 400, mensagem: "Usuário não encontrado." });
		}

		const token = uuidv4();
		const expiresAt = new Date(Date.now() + 3600000); // expira em 1h

		await PasswordResets.create({
			idUsuario: user.idUsuario,
			token,
			expiresAt,
			used: false,
		});

		const transporter = nodemailer.createTransport({
			host: "mail.clareavital.com.br",
			port: 465,
			secure: true,
			auth: {
				user: "clareavital@clareavital.com.br",
				pass: process.env.EMAIL_PASS,
			},
		});

		const link = `${process.env.URL_FRONTEND}/resetarSenha?token=${token}`;

		// Envio do e-mail HTML diretamente aqui
		await transporter.sendMail({
			from: '"Clarea Vital" <clareavital@clareavital.com.br>',
			to: email,
			subject: "Recuperação de senha",
			text: `Olá, ${user.Nome}. Clique no link para redefinir sua senha: ${link}`,
			html: `
			<!DOCTYPE html>
			<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Recuperação de Senha</title>
			</head>
			<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
				<table width="100%" cellpadding="0" cellspacing="0">
					<tr>
						<td align="center" style="padding: 30px 10px;">
							<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
								<tr>
									<td align="center" style="background-color: #0b243d; padding: 20px;">
										<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Clarea Vital</h1>
									</td>
								</tr>
								<tr>
									<td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.5;">
										<p>Olá, <strong>${user.Nome}</strong>,</p>
										<p>Recebemos uma solicitação para redefinir sua senha. Para continuar, clique no botão abaixo:</p>
										<p style="text-align: center; margin: 30px 0;">
											<a href="${link}" target="_blank" style="background-color: #0b243d; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 16px; border-radius: 5px; display: inline-block;">Redefinir Senha</a>
										</p>
										<p>Se você não solicitou a redefinição da senha, pode ignorar este e-mail com segurança.</p>
										<p style="margin-top: 20px;">Atenciosamente,<br><strong>Equipe Clarea Vital</strong></p>
									</td>
								</tr>
								<tr>
									<td align="center" style="background-color: #f4f4f4; padding: 15px; font-size: 12px; color: #666666;">
										<p>© ${new Date().getFullYear()} Clarea Vital. Todos os direitos reservados.</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
			</html>
			`,
		});

		console.log(`[END] POST /recuperarSenha - Link enviado para o e-mail.`);
		return res.send({ status: 200, mensagem: "Link de recuperação enviado para o e-mail." });

	} catch (error) {
		console.error(error);
		res.status(500).send({ mensagem: "Erro interno no servidor." });
		console.log(`[END] POST /recuperarSenha - Erro interno.`);
	}
});


app.post("/resetarSenha", async (req, res) => {
	console.log(`[START] POST /resetarSenha - body:`, req.body);
	try {
		const { token, novaSenha } = req.body;

		// Busca o token no banco
		const reset = await PasswordResets.findOne({ where: { token, used: false } });

		if (!reset) {
			console.log(`[END] POST /resetarSenha - Token inválido ou já utilizado.`);
			return res.status(400).send({ mensagem: "Token inválido ou já utilizado." });
		}

		// Verifica se expirou
		if (reset.expiresAt < new Date()) {
			console.log(`[END] POST /resetarSenha - Token expirado.`);
			return res.status(400).send({ mensagem: "Token expirado." });
		}

		// Busca o usuário dono do token
		const user = await Usuario.findByPk(reset.idUsuario);
		if (!user) {
			console.log(`[END] POST /resetarSenha - Usuário não encontrado.`);
			return res.status(404).send({ mensagem: "Usuário não encontrado." });
		}

		// Gera hash da nova senha
		const hash = await bcrypt.hash(novaSenha, 10);

		// Atualiza senha do usuário
		user.Senha = hash; // coluna da tabela `Usuarios`
		await user.save();

		// Marca token como usado
		reset.used = true;
		await reset.save();

		console.log(`[END] POST /resetarSenha - Senha alterada com sucesso!`);
		return res.send({ status: 200, mensagem: "Senha alterada com sucesso!" });

	} catch (error) {
		console.error(error);
		res.status(500).send({ mensagem: "Erro interno no servidor." });
		console.log(`[END] POST /resetarSenha - Erro interno.`);
	}
});

app.post("/validarToken", autenticarToken, async (req, res) => {
	console.log(`[START] POST /validarToken - body:`, req.body);
	res.send({ status: 200, mensagem: 'Token válido.', usuario: req.usuario });
	console.log(`[END] POST /validarToken`);
});

app.post("/enviarEmail", async (req, res) => {
	console.log(`[START] POST /enviarEmail - body:`, req.body);
	const { email } = req.body;

	const usuario = await Usuario.findOne({ where: { Email: email } });
	if (usuario) {
		console.log(`[END] POST /enviarEmail - Usuário já cadastrado.`);
		return res.send({ status: "400", erro: 'Usuário já cadastrado.' });
	}

	const codigo = Math.floor(100000 + Math.random() * 900000).toString();
	const expiraEm = new Date(Date.now() + 10 * 60000); // 10 minutos

	await ConfirmacaoConta.create({
		email,
		codigo,
		expiraEm,
	});

	const result = await sendEmail(email, "Assunto do E-mail", `Seu código de confirmação é:`, codigo);

	if (result.success) {
		res.send({ status: 200, message: "E-mail enviado com sucesso!" });
		console.log(`[END] POST /enviarEmail - E-mail enviado com sucesso!`);
	} else {
		res.send({ status: 500, message: "Erro ao enviar e-mail.", error: result.error });
		console.log(`[END] POST /enviarEmail - Erro ao enviar e-mail.`);
	}
});

app.post("/salvarLead", async (req, res) => {
	console.log(`[START] POST /salvarLead - body:`, req.body);
	const { idLead, nome, email, telefone, cpf, cnpj, razaoSocial, stepAtual } = req.body;

	try {
		let lead;

		if (idLead) {
			// 🔄 Atualiza se já existir
			lead = await Lead.findByPk(idLead);

			if (lead) {
				await lead.update({
					nome: nome ?? lead.nome,
					email: email ?? lead.email,
					telefone: telefone ?? lead.telefone,
					cpf: cpf ?? lead.cpf,
					cnpj: cnpj ?? lead.cnpj,
					razaoSocial: razaoSocial ?? lead.razaoSocial,
					stepAtual: stepAtual ?? lead.stepAtual,
				});
				console.log(`[INFO] Lead atualizado (id=${idLead})`);
			} else {
				console.log(`[WARN] idLead ${idLead} não encontrado. Criando novo lead...`);
				lead = await Lead.create({
					nome,
					email,
					telefone,
					cpf,
					cnpj,
					razaoSocial,
					stepAtual,
				});
			}
		} else {
			// 🆕 Cria novo lead
			lead = await Lead.create({
				nome,
				email,
				telefone,
				cpf,
				cnpj,
				razaoSocial,
				stepAtual,
			});
			console.log(`[INFO] Novo lead criado (id=${lead.idLead})`);
		}

		res.send({ status: 200, mensagem: "Lead salvo com sucesso!", lead });
		console.log(`[END] POST /salvarLead - Sucesso`);
	} catch (error) {
		console.error(`[ERROR] /salvarLead:`, error);
		res.status(500).send({ mensagem: "Erro interno no servidor." });
		console.log(`[END] POST /salvarLead - Erro interno.`);
	}
});


app.post('/confirmarConta', async (req, res) => {
	console.log(`[START] POST /confirmarConta - body:`, req.body);
	const { email, codigo } = req.body;

	try {
		const confirmacao = await ConfirmacaoConta.findOne({
			where: {
				email: email,
				codigo
			}
		});

		if (!confirmacao) {
			console.log(`[END] POST /confirmarConta - Código de confirmação inválido.`);
			return res.send({ status: 400, mensagem: 'Código de confirmação inválido.' });
		}

		if (confirmacao.expiraEm < new Date()) {
			console.log(`[END] POST /confirmarConta - Código de confirmação expirado.`);
			return res.send({ status: 400, mensagem: 'Código de confirmação expirado.' });
		}

		await ConfirmacaoConta.destroy({
			where: {
				email: email
			}
		});

		res.send({ status: 200, mensagem: 'Conta confirmada com sucesso.' });
		console.log(`[END] POST /confirmarConta - Conta confirmada com sucesso.`);
	} catch (error) {
		console.error(error);
		res.send({ status: 500, mensagem: 'Erro interno no servidor.' });
		console.log(`[END] POST /confirmarConta - Erro interno no servidor.`);
	}
});

app.get('/getDiscount', async (req, res) => {
	console.log(`[START] GET /getDiscount - params:`, req.params, '- query:', req.query);

	try {
		const response = await Descontos.findAll({
			where: { status: true }
		});

		res.send({ status: 200, data: response });
		console.log(`[END] GET /getDiscount - sucesso`);
	} catch (error) {
		console.error(`[ERROR] GET /getDiscount -`, error);
		res.status(500).send({ message: "Erro ao buscar descontos", error });
	}
});



app.post('/cadastro', async (req, res) => {

	const { nome, email, tipoPessoa, cpf, cnpj, razaoSocial, telefone, senha, cep, estado, cidade, bairro, endereco, numero, complemento } = req.body;

	// const hoje = new Date();
	// const dataFormatada = hoje.toISOString().split('T')[0];

	// const urlAcessorias = `https://api.acessorias.com/companies?cnpj=${cnpj || cpf}&nome=${nome || "Não informado"}&fantasia=${razaoSocial || "Não informado"}&dtcadastro=${dataFormatada}&dtclidesde=${dataFormatada}&endlogradouro=${endereco}&endnumero=${numero}&endcomplemento=${complemento}&cep=${cep}&bairro=${bairro}&cidade=${cidade}&uf=${estado}&fone=${telefone}`;
	// const headersAcessorias = { 'Authorization': `Bearer ${process.env.TOKEN_ACESSORIAS}` };

	// try {
	// 	const responseAcessorias = await axios.post(urlAcessorias, {}, { headers: headersAcessorias });
	// 	console.log("Cliente cadastrado no Acessorias:", responseAcessorias.data);
	// } catch (error) {
	// 	console.error("Erro ao cadastrar cliente no Acessorias:", error.message);
	// }

	let idAsaas = "";
	const url = 'https://api-sandbox.asaas.com/v3/customers';
	const headers = { 'accept': 'application/json', 'content-type': 'application/json', 'access_token': process.env.TOKEN_ASAAS };
	const body = {
		name: nome,
		cpfCnpj: tipoPessoa === 'pessoaFisica' ? cpf : cnpj,
		email: email,
		phone: null,
		mobilePhone: telefone,
		address: null,
		addressNumber: numero,
		complement: complemento,
		province: null,
		postalCode: cep,
		externalReference: null,
		notificationDisabled: false,
		additionalEmails: null,
		municipalInscription: null,
		stateInscription: null,
		observations: null,
		groupName: null,
		company: null,
		foreignCustomer: false
	};

	try {
		const response = await axios.post(url, body, { headers });
		idAsaas = response.data.id;

		console.log('Cliente criado no Asaas:', response.data);
	} catch (error) {
		console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
		res.send({ status: 500, mensagem: 'Erro ao criar cliente no Asaas.' });
	}

	try {
		// Busca o termo mais recente
		const termoAtual = await TermosDeUso.findOne({ order: [['DataCriacao', 'DESC']] });

		if (!termoAtual) {
			return res.send({ status: 400, mensagem: 'Nenhum termo de uso cadastrado no sistema.' });
		}
		console.log('Termo atual:', termoAtual);

		const senhaHash = await bcrypt.hash(senha, 10);
		const usuario = await Usuario.create({
			Nome: nome,
			Email: email,
			Senha: senhaHash,
			TipoPessoa: tipoPessoa,
			Cpf: cpf,
			Cnpj: cnpj,
			RazaoSocial: razaoSocial,
			Telefone: telefone,
			idAsaas: idAsaas,
			TokenZapSign: "TokenZapSign"
		});

		if (!usuario) {
			return res.send({ status: 400, mensagem: 'Erro ao cadastrar usuário.' });
		}
		console.log('Usuário cadastrado no banco de dados.');

		const notificacao = await Notificacoes.create({
			idUsuario: usuario.idUsuario,
			titulo: 'Bem-vindo!',
			descricao: 'Sua conta foi criada com sucesso.',
			data: new Date()
		});

		if (!notificacao) {
			return res.send({ status: 400, mensagem: 'Erro ao cadastrar notificação.' });
		}

		console.log('Notificação cadastrada no banco de dados.');

		const enderecoResponse = await Endereco.create({
			idUsuario: usuario.idUsuario,
			Cep: cep,
			Estado: estado,
			Cidade: cidade,
			Bairro: bairro,
			Endereco: endereco,
			Numero: numero,
			Complemento: complemento
		});

		if (!enderecoResponse) {
			return res.send({ status: 400, mensagem: 'Erro ao cadastrar endereço.' });
		}

		console.log('Endereço cadastrado no banco de dados.');

		const consentimentoResponse = await Consentimento.create({
			idUsuario: usuario.idUsuario,
			idTermo: termoAtual.idTermo
		});

		if (!consentimentoResponse) {
			return res.send({ status: 400, mensagem: 'Erro ao registrar consentimento.' });
		}

		console.log('Consentimento registrado no banco de dados.');

		res.send({ status: 200, mensagem: 'Usuário cadastrado e consentimento registrado.' });
	} catch (err) {
		res.send({ status: 400, mensagem: 'Erro ao cadastrar usuário e registrar consentimento.' });
	}
});

app.post('/login', async (req, res) => {
	const { email, senha } = req.body;
	const usuario = await Usuario.findOne({ where: { Email: email } });

	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	const senhaValida = await bcrypt.compare(senha, usuario.Senha);
	if (!senhaValida) return res.send({ status: 400, mensagem: 'Senha incorreta.' });

	const token = jwt.sign({ id: usuario.idUsuario, email: usuario.Email }, process.env.JWT_SECRET, {
		expiresIn: '24h'
	});

	res.send({ status: 200, mensagem: 'Login realizado com sucesso.', token, usuario });

});

app.post('/loginAdm', async (req, res) => {
	const { email, senha } = req.body;
	const usuario = await Usuario.findOne({ where: { Email: email } });
	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	const admin = await Admins.findOne({ where: { idUsuario: usuario.idUsuario } });
	if (!admin) return res.send({ status: 400, mensagem: 'Acesso negado.' });

	const senhaValida = await bcrypt.compare(senha, usuario.Senha);
	if (!senhaValida) return res.send({ status: 400, mensagem: 'Senha incorreta.' });

	const token = jwt.sign({ id: usuario.idUsuario, email: usuario.Email }, process.env.JWT_SECRET, {
		expiresIn: '24h'
	});

	res.send({ status: 200, mensagem: 'Login realizado com sucesso.', token, usuario });

});

app.get('/perfil', autenticarToken, async (req, res) => {
	const usuario = await Usuario.findByPk(req.usuario.id, {
		attributes: ['idUsuario', 'Nome', 'Email', 'TipoPessoa', 'Cpf', 'Cnpj', 'RazaoSocial', 'Telefone']
	});

	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	res.send({ status: 200, usuario });
});

// app.post('/getUserByEmail', autenticarToken, async (req, res) => {
// 	const { email } = req.body;
// 	console.log(email)

// 	const usuario = await Usuario.findOne({
// 		where: { Email: email },
// 		attributes: ['idUsuario', 'Nome', 'Email', 'TipoPessoa', 'Cpf', 'Cnpj', 'RazaoSocial', 'Telefone']
// 	});

// 	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

// 	res.send({ status: 200, usuario });
// });


app.post("/criarAssinatura", autenticarToken, async (req, res) => {
	const { email, valor, metodo, idPlano, titulo, periodicidade, idDesconto, cardData } = req.body;

	if (!email) {
		res.send({ status: 400, mensagem: 'Email é obrigatório.' });
		return;
	}

	const usuario = await Usuario.findOne({ where: { Email: email } });
	if (!usuario) {
		return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });
	}

	const endereco = await Endereco.findOne({ where: { idUsuario: usuario.idUsuario } });
	if (!endereco) {
		return res.send({ status: 400, mensagem: 'Endereço não encontrado.' });
	}

	let nextDueDate;

	if (metodo === 'BOLETO') {
		// 5 dias a partir de hoje
		nextDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
	} else if (metodo === 'CREDIT_CARD') {
		// próximo dia útil (mínimo recomendado pela API)
		nextDueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
	} else {
		return res.send({ status: 400, erro: "Forma de pagamento inválida" });
	}


	const idAsaas = usuario.idAsaas;
	const url = 'https://api-sandbox.asaas.com/v3/subscriptions';
	const headers = {
		'accept': 'application/json',
		'content-type': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const body = {
		billingType: metodo,
		cycle: periodicidade === "anual" ? 'YEARLY' : 'MONTHLY',
		customer: idAsaas,
		value: valor,
		nextDueDate: nextDueDate,
		discount: {
			value: 0,
			dueDateLimitDays: 0,
			type: 'PERCENTAGE'
		},
		interest: { value: 0 },
		fine: { value: 0, type: 'FIXED' },
		description: titulo || 'Assinatura do Plano',
		endDate: null,
		maxPayments: null,
		externalReference: null,
		updatePendingPayments: true
	};

	// Se for pagamento por cartão de crédito, adiciona os dados do cartão
	if (metodo === 'CREDIT_CARD') {
		if (!cardData) {
			return res.send({ status: 400, erro: "Dados do cartão e do titular são obrigatórios para pagamento por cartão." });
		}

		const mes = cardData.expiry.slice(0, 2);
		const ano = cardData.expiry.slice(3, 7);

		body.creditCard = {
			holderName: cardData.name,
			number: cardData.number,
			expiryMonth: mes,
			expiryYear: ano,
			ccv: cardData.cvv
		};

		body.creditCardHolderInfo = {
			name: cardData.name,
			email: usuario.Email,
			cpfCnpj: usuario.Cpf || usuario.Cnpj,
			postalCode: endereco.Cep,
			addressNumber: endereco.Numero,
			phone: usuario.Telefone
		};
	}

	if (idDesconto) {
		const adicionarDesconto = await DescontosUsados.create({
			idUsuario: usuario.idUsuario,
			idDesconto: idDesconto,
		});

		if (!adicionarDesconto) {
			return res.send({ status: 400, mensagem: 'Erro ao adicionar desconto.' });
		}
	}

	console.log(body)
	const response = await axios.post(url, body, { headers });
	console.log(response)

	if (response.data && response.data.id) {
		await Assinaturas.create({
			idUsuario: usuario.idUsuario,
			idPlano: idPlano,
			idAssinaturaAsaas: response.data.id,
			idAsaas: idAsaas,
			status: response.data.status?.toUpperCase() || 'PENDENTE',
			dataInicio: new Date(),
			dataFim: null,
			proximaCobranca: response.data.nextDueDate || null,
			ultimaCobranca: null
		});

		return res.send({
			status: 200,
			data: response.data
		});
	} else {
		return res.send({
			status: 400,
			erro: 'Erro ao criar assinatura.'
		});
	}
});

app.get("/hasPlan", autenticarToken, async (req, res) => {
	console.log(req.usuario)
	const assinaturas = await Assinaturas.findOne({ where: { idUsuario: req.usuario.id } });
	if (!assinaturas) {
		return res.send({ status: 400, mensagem: 'Usuário não possui um plano ativo.' });
	}

	res.send({ status: 200, mensagem: 'Usuário possui um plano ativo.' });
});

app.post("/buscarPlano", autenticarToken, async (req, res) => {
	const { id } = req.usuario;

	const plano = await Assinaturas.findOne({ where: { idUsuario: id } });
	if (!plano) {
		return res.send({ status: 400, mensagem: 'Plano não encontrado.' });
	}

	const url = `https://api-sandbox.asaas.com/v3/subscriptions/${plano.idAssinaturaAsaas}/payments?status=RECEIVED`
	const headers = {
		accept: 'application/json',
		access_token: process.env.TOKEN_ASAAS
	}

	const response = await axios.get(url, { headers });

	if (!response) {
		res.send({ status: 400, mensagem: 'Erro ao buscar pagamentos.' });
	}

	const urlAssinatura = `https://api-sandbox.asaas.com/v3/subscriptions/${plano.idAssinaturaAsaas}`;
	const headersAssinatura = {
		accept: 'application/json',
		access_token: process.env.TOKEN_ASAAS
	}

	const responseAssinatura = await axios.get(urlAssinatura, { headers: headersAssinatura });

	res.send({ status: 200, pagamentos: response.data.data, assinatura: responseAssinatura.data });
});

app.post("/gerarContratoZapSign", autenticarToken, async (req, res) => {

	const { email } = req.body;

	const usuario = await Usuario.findOne({ where: { Email: email } });
	if (!usuario) {
		return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });
	}

	const urlZapSign = `https://sandbox.api.zapsign.com.br/api/v1/docs/${process.env.TOKEN_CONTRATO_ZAPSIGN}/add-signer/`;
	const headersZapSign = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${process.env.TOKEN_ZAPSIGN}`
	};

	const bodyZapSign = {
		name: usuario.Nome,
		email,
		redirect_link: `${process.env.URL_FRONTEND}/AssinarContrato`
	};

	const responseZapSign = await axios.post(urlZapSign, bodyZapSign, { headers: headersZapSign });
	if (!responseZapSign) {
		res.send({ status: 400, mensagem: 'Assinatura ainda nao foi verificada' });
	}

	console.log(responseZapSign.data);

	if (responseZapSign) {
		await Usuario.update({
			TokenZapSign: responseZapSign.data.token
		}, {
			where: {
				idUsuario: usuario.idUsuario
			}
		});
	}

	console.log('Assinatura criada:', responseZapSign.data);
	res.send({ status: 200, mensagem: 'Contrato gerado com sucesso.' });
})

app.post("/getContrato", autenticarToken, async (req, res) => {
	const { idUsuario } = req.body;

	const response = await Usuario.findOne({ where: { idUsuario }, attributes: ["TokenZapSign"] });
	if (!response) {
		return res.send({ status: 400, mensagem: 'Contrato não encontrado.' });
	}

	const urlZapSign = `https://sandbox.api.zapsign.com.br/api/v1/signers/${response.dataValues.TokenZapSign}`;
	const headersZapSign = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${process.env.TOKEN_ZAPSIGN}`
	};

	const responseZapSign = await axios.get(urlZapSign, { headers: headersZapSign });

	res.send({ status: 200, data: responseZapSign.data });
})

app.post("/atualizarPerfil", autenticarToken, async (req, res) => {
	const { Nome, Email, Cpf, Cnpj, RazaoSocial, Telefone, rua, Numero, Bairro, Cidade, Estado, Cep, Complemento } = req.body;

	const usuario = await Usuario.findOne({ where: { Email } });
	console.log(usuario.dataValues.idUsuario)
	try {
		await Usuario.update({
			Nome,
			Cpf,
			Cnpj,
			RazaoSocial,
			Telefone
		}, {
			where: {
				idUsuario: usuario.dataValues.idUsuario
			}
		});

		await Endereco.update({
			Endereco: rua,
			Numero,
			Bairro,
			Cidade,
			Estado,
			Cep,
			Complemento
		}, {
			where: {
				idUsuario: usuario.dataValues.idUsuario
			}
		});

		res.send({ status: 200, mensagem: 'Perfil atualizado com sucesso.' });
	} catch (error) {
		console.log(error)
		res.send({ status: 400, erro: 'Erro ao atualizar perfil.' });
	}
});

app.get("/mudarPlano/getPlanos/:idPlano", autenticarToken, async (req, res) => {
	const { idPlano } = req.params;

	// Busca o plano atual
	const planoAtual = await Planos.findOne({
		where: {
			idPlano,
			Ativo: true
		}
	});

	if (!planoAtual) {
		return res.send({ status: 400, mensagem: 'Plano não encontrado.' });
	}

	// Busca os planos com idPlano maior do que o atual
	const planosMaiores = await Planos.findAll({
		where: {
			idPlano: {
				[Op.gte]: idPlano
			},
			Ativo: true
		},
		order: [['idPlano', 'ASC']] // opcional: ordenar por idPlano crescente
	});

	res.send({ status: 200, data: planosMaiores });
});

app.post("/mudarPlano/mudarPlano", autenticarToken, async (req, res) => {
	const { idPlanoEscolhido } = req.body;

	const plano = await Planos.findOne({ where: { idPlano: idPlanoEscolhido, Ativo: true } });
	if (!plano) return res.send({ status: 400, mensagem: 'Plano não encontrado.' });

	const assinaturaAtual = await Assinaturas.findOne({ where: { idUsuario: req.usuario.id } });
	if (!assinaturaAtual) {
		return res.send({ status: 400, mensagem: 'Assinatura atual não encontrada.' });
	}

	const urlAssas = `https://api-sandbox.asaas.com/v3/subscriptions/${assinaturaAtual.idAssinaturaAsaas}`;
	const headersAssas = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS,
		'content-type': 'application/json'
	};
	const bodyAssas = {
		value: plano.valorNovoMensal,
	}

	const responseAssas = await axios.put(urlAssas, bodyAssas, { headers: headersAssas });
	if (responseAssas.status !== 200) {
		return res.send({ status: 400, mensagem: 'Erro ao atualizar assinatura no Asaas.' });
	}

	// Atualiza o plano do usuário
	await Assinaturas.update({ idPlano: idPlanoEscolhido }, { where: { idUsuario: req.usuario.id } });

	res.send({ status: 200, mensagem: 'Plano alterado com sucesso.' });
});

app.post("/dashboard", autenticarToken, async (req, res) => {
	const { email } = req.body;
	console.log(email)

	// verifica se o usuario usou desconto
	const descontoUsado = await DescontosUsados.findOne({ where: { idUsuario: req.usuario.id } });
	if (descontoUsado) {
		const assinatura = await Assinaturas.findOne({ where: { idUsuario: req.usuario.id } });
		const desconto = await Descontos.findOne({ where: { idDesconto: descontoUsado.idDesconto } });

		const inicio = new Date(assinatura.dataInicio);
		const fim = new Date(inicio);
		fim.setMonth(fim.getMonth() + desconto.duracaoMeses);

		const agora = new Date();
		if (agora > fim || desconto.status === false) {
			const plano = await Planos.findOne({ where: { idPlano: assinatura.idPlano } });

			const urlAssas = `https://api-sandbox.asaas.com/v3/subscriptions/${assinatura.idAssinaturaAsaas}`;
			const headersAssas = {
				'accept': 'application/json',
				'access_token': process.env.TOKEN_ASAAS,
				'content-type': 'application/json'
			};
			const bodyAssas = {
				value: plano.valorNovoMensal,
			}

			const responseAssas = await axios.put(urlAssas, bodyAssas, { headers: headersAssas });
			if (responseAssas.status !== 200) {
				return res.send({ status: 400, mensagem: 'Erro ao atualizar assinatura no Asaas.' });
			}

			const notificacao = await Notificacoes.create({
				idUsuario: req.usuario.id,
				titulo: 'Período de desconto encerrado',
				descricao: 'Seu período de desconto chegou ao fim. O valor da sua assinatura foi atualizado para o valor original do plano.',
				data: new Date()
			});
			if (!notificacao) {
				return res.send({ status: 400, mensagem: 'Erro ao cadastrar notificação.' });
			}
		} else {
			console.log("Ainda dentro do período de desconto");
		}
	}


	//b4a113da-554b-41e1-b548-ed564a12409b token zapsign
	const tokenZapSign = await Usuario.findOne({ where: { Email: email }, attributes: ["TokenZapSign"] });

	const urlZapSign = `https://sandbox.api.zapsign.com.br/api/v1/signers/${tokenZapSign.dataValues.TokenZapSign}`;
	const headersZapSign = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${process.env.TOKEN_ZAPSIGN}`
	};

	const responseZapSign = await axios.get(urlZapSign, { headers: headersZapSign });

	// if (responseZapSign.data.status === "signed") {
	// 	await Usuario.update({ FirstTime: false }, { where: { Email: email } });
	// }

	if (!responseZapSign) return res.send({ status: 400, mensagem: 'Erro ao buscar dados do ZapSign.' });

	const usuario = await Usuario.findOne({ where: { Email: email }, attributes: ["idUsuario", "Nome", "Email", "TipoPessoa", "Cpf", "Cnpj", "RazaoSocial", "Telefone", "idAsaas", "FirstTime"] });

	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	const endereco = await Endereco.findOne({ where: { idUsuario: usuario.idUsuario } });

	if (!endereco) return res.send({ status: 400, mensagem: 'Endereço não encontrado.' });

	const assinaturas = await Assinaturas.findOne({ where: { idUsuario: usuario.idUsuario } });

	if (!assinaturas) return res.send({ status: 400, mensagem: 'Assinaturas não encontradas.' });

	const plano = await Planos.findOne({ where: { idPlano: assinaturas.idPlano } });

	const url = `https://api-sandbox.asaas.com/v3/payments?customer=${usuario.idAsaas}`;

	const headers = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const response = await axios.get(url, { headers });

	let pagas = [];
	let pendentes = [];
	let vencidas = [];
	let reembolsadas = [];
	let chargebacks = [];

	for (let fatura of response.data.data) {
		const status = fatura.status;

		if (['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED'].includes(status)) {
			pagas.push(fatura);
		} else if (['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(status)) {
			pendentes.push(fatura);
		} else if (['OVERDUE', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED'].includes(status)) {
			vencidas.push(fatura);
		} else if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS'].includes(status)) {
			reembolsadas.push(fatura);
		} else if (['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(status)) {
			chargebacks.push(fatura);
		}
	}

	const urlAssinaturaAsaas = `https://api-sandbox.asaas.com/v3/subscriptions/${assinaturas.dataValues.idAssinaturaAsaas}`

	const headersAssinaturaAsaas = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const responseAssinaturaAsaas = await axios.get(urlAssinaturaAsaas, { headers: headersAssinaturaAsaas });

	const objeto = {
		usuario: usuario.dataValues,
		assinatura: assinaturas.dataValues,
		plano: plano.dataValues,
		faturas: {
			pagas,
			pendentes,
			vencidas,
			reembolsadas,
			chargebacks
		},
		zapSign: responseZapSign.data,
		endereco: endereco.dataValues,
		asaas: responseAssinaturaAsaas.data
	};

	res.send({ status: 200, objeto });
});

app.post("/buscarNotificacoes", autenticarToken, async (req, res) => {
	const { email } = req.body;

	const usuario = await Usuario.findOne({ where: { Email: email } });

	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	const limiteData = new Date();
	limiteData.setDate(limiteData.getDate() - 5);

	// Deleta notificações mais antigas que 5 dias
	await Notificacoes.destroy({
		where: {
			idUsuario: usuario.idUsuario,
			data: { [Op.lt]: limiteData }
		}
	});

	const notificacoes = await Notificacoes.findAll({ where: { idUsuario: usuario.idUsuario } });

	res.send({ status: 200, notificacoes });
});

app.post("/handleFirstTime", autenticarToken, async (req, res) => {
	const { email } = req.body;

	const usuario = await Usuario.findOne({ where: { Email: email } });

	if (!usuario) return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });

	try {
		await Usuario.update({ FirstTime: false }, { where: { Email: email } });
		res.send({ status: 200, mensagem: 'Primeiro acesso tratado com sucesso.' });
	} catch (error) {
		console.log(error);
		res.send({ status: 400, erro: 'Erro ao tratar primeiro acesso.' });
	}
});

app.get("/listarPlanos", async (req, res) => {
	const planos = await Planos.findAll();

	if (planos) {
		res.send({ status: 200, planos })
	} else {
		res.send({ status: 400, erro: 'Nenhum plano encontrado.' })
	}
});

app.post("/cancelarAssinatura", autenticarToken, async (req, res) => {
	const { idAssinaturaAsaas, motivosSelecionados, outroMotivo } = req.body;

	const urlAssas = `https://api-sandbox.asaas.com/v3/subscriptions/${idAssinaturaAsaas}`;
	const headersAssas = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};
	const responseAssas = await axios.delete(urlAssas, { headers: headersAssas });

	if (responseAssas.status !== 200) {
		return res.send({ status: 400, mensagem: 'Erro ao remover assinatura no Asaas.' });
	}

	const assinatura = await Assinaturas.destroy({ where: { idAssinaturaAsaas } });
	if (!assinatura) {
		return res.send({ status: 400, mensagem: 'Erro ao cancelar assinatura localmente.' });
	}
	const cancelamento = await Cancelamentos.create({
		idUsuario: req.usuario.id,
		motivosSelecionados,
		outroMotivo,
		dataCancelamento: new Date()
	});
	if (!cancelamento) {
		return res.send({ status: 400, mensagem: 'Erro ao registrar motivo de cancelamento.' });
	}

	res.send({ status: 200, mensagem: 'Assinatura cancelada com sucesso.' });
});

// requests ADM

app.post("/verificarTokenAdmin", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });
	
	res.send({ status: 200, mensagem: 'Token válido.' });
});

app.get("/listarCancelamentos", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const cancelamentos = await Cancelamentos.findAll();
	res.send({ status: 200, cancelamentos });
});

app.get('/leads/recuperaveis', async (req, res) => {
	try {
		const leads = await Lead.findAll({
			where: {
				stepAtual: {
					[require("sequelize").Op.lt]: 5
				}
			},
			attributes: ['idLead', 'nome', 'telefone', 'email', 'stepAtual'] // só os dados úteis
		});
		res.json(leads);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Erro ao buscar leads recuperáveis" });
	}
});


app.post("/adicionarAdmin", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { nome, email, senha } = req.body;
	const idAsaas = "vazio", TokenZapSign = "vazio";

	const responseUsuario = await Usuario.findOne({ where: { Email: email } });
	if (responseUsuario) return res.send({ status: 400, mensagem: "E-mail ja cadastrado" });

	const senhaHash = await bcrypt.hash(senha, 10);

	const response = await Usuario.create({
		Nome: nome,
		Email: email,
		TipoPessoa: "pessoaFisica",
		Senha: senhaHash,
		idAsaas,
		TokenZapSign
	});
	if (!response) return res.send({ status: 400, mensagem: "Erro ao criar admin." });

	const responseAdmin = await Admins.create({ idUsuario: response.dataValues.idUsuario, Nivel: 1 });
	if (!responseAdmin) return res.send({ status: 400, mensagem: "Erro ao criar admin." });

	res.send({ status: 200, mensagem: "Admin criado com sucesso." });
});

app.post("/recuperarSenhaAdmin", async (req, res) => {
	try {
		const { email } = req.body;
		const user = await Usuario.findOne({ where: { Email: email } });

		if (!user) {
			console.log(`[END] POST /recuperarSenha - Usuário não encontrado.`);
			return res.send({ status: 400, mensagem: "Usuário não encontrado." });
		}

		const token = uuidv4();
		const expiresAt = new Date(Date.now() + 3600000); // expira em 1h

		await PasswordResets.create({
			idUsuario: user.idUsuario,
			token,
			expiresAt,
			used: false,
		});

		const transporter = nodemailer.createTransport({
			host: "mail.clareavital.com.br",
			port: 465,
			secure: true,
			auth: {
				user: "clareavital@clareavital.com.br",
				pass: process.env.EMAIL_PASS,
			},
		});

		const link = `${process.env.URL_FRONTEND_ADM}/EsqueceuSenha?token=${token}`;

		// Envio do e-mail HTML diretamente aqui
		await transporter.sendMail({
			from: '"Clarea Vital" <clareavital@clareavital.com.br>',
			to: email,
			subject: "Recuperação de senha",
			text: `Olá, ${user.Nome}. Clique no link para redefinir sua senha: ${link}`,
			html: `
			<!DOCTYPE html>
			<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Recuperação de Senha</title>
			</head>
			<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
				<table width="100%" cellpadding="0" cellspacing="0">
					<tr>
						<td align="center" style="padding: 30px 10px;">
							<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
								<tr>
									<td align="center" style="background-color: #0b243d; padding: 20px;">
										<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Clarea Vital</h1>
									</td>
								</tr>
								<tr>
									<td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.5;">
										<p>Olá, <strong>${user.Nome}</strong>,</p>
										<p>Recebemos uma solicitação para redefinir sua senha. Para continuar, clique no botão abaixo:</p>
										<p style="text-align: center; margin: 30px 0;">
											<a href="${link}" target="_blank" style="background-color: #0b243d; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 16px; border-radius: 5px; display: inline-block;">Redefinir Senha</a>
										</p>
										<p>Se você não solicitou a redefinição da senha, pode ignorar este e-mail com segurança.</p>
										<p style="margin-top: 20px;">Atenciosamente,<br><strong>Equipe Clarea Vital</strong></p>
									</td>
								</tr>
								<tr>
									<td align="center" style="background-color: #f4f4f4; padding: 15px; font-size: 12px; color: #666666;">
										<p>© ${new Date().getFullYear()} Clarea Vital. Todos os direitos reservados.</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
			</html>
			`,
		});

		console.log(`[END] POST /recuperarSenha - Link enviado para o e-mail.`);
		return res.send({ status: 200, mensagem: "Link de recuperação enviado para o e-mail." });

	} catch (error) {
		console.error(error);
		res.status(500).send({ mensagem: "Erro interno no servidor." });
		console.log(`[END] POST /recuperarSenha - Erro interno.`);
	}
});

app.post("/redefinirSenhaAdmin", async (req, res) => {
	console.log(`[START] POST /redefinirSenhaAdmin - body:`, req.body);
	try {
		const { token, senha } = req.body;

		// Busca o token no banco
		const reset = await PasswordResets.findOne({ where: { token, used: false } });

		if (!reset) {
			console.log(`[END] POST /resetarSenha - Token inválido ou já utilizado.`);
			return res.status(400).send({ mensagem: "Token inválido ou já utilizado." });
		}

		// Verifica se expirou
		if (reset.expiresAt < new Date()) {
			console.log(`[END] POST /resetarSenha - Token expirado.`);
			return res.status(400).send({ mensagem: "Token expirado." });
		}

		// Busca o usuário dono do token
		const user = await Usuario.findByPk(reset.idUsuario);
		if (!user) {
			console.log(`[END] POST /resetarSenha - Usuário não encontrado.`);
			return res.status(404).send({ mensagem: "Usuário não encontrado." });
		}

		// Gera hash da nova senha
		const hash = await bcrypt.hash(senha, 10);

		// Atualiza senha do usuário
		user.Senha = hash; // coluna da tabela `Usuarios`
		await user.save();

		// Marca token como usado
		reset.used = true;
		await reset.save();

		console.log(`[END] POST /resetarSenha - Senha alterada com sucesso!`);
		return res.send({ status: 200, mensagem: "Senha alterada com sucesso!" });

	} catch (error) {
		console.error(error);
		res.status(500).send({ mensagem: "Erro interno no servidor." });
		console.log(`[END] POST /resetarSenha - Erro interno.`);
	}
});

app.get("/listarUsuarios", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	try {
		const usuarios = await Usuario.findAll({
			include: [
				{
					model: Admins,
					attributes: ["idAdmin"],
					required: false,
				},
			],
			where: {
				"$admin.idAdmin$": null,
			},
		});

		if (usuarios.length > 0) {
			res.send({ status: 200, usuarios });
		} else {
			res.send({ status: 400, erro: "Nenhum usuário não-admin encontrado." });
		}
	} catch (err) {
		console.error(err);
		res.status(500).send({ status: 500, erro: "Erro ao buscar usuários." });
	}
});

app.get("/listarAdmins", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: "Acesso negado." });

	try {
		const usuarios = await Usuario.findAll({
			include: [
				{
					model: Admins,
					attributes: ["idAdmin", "Nivel"],
					required: true,
				},
			],
		});

		if (usuarios.length > 0) {
			res.send({ status: 200, usuarios });
		} else {
			res.send({ status: 400, erro: "Nenhum admin encontrado." });
		}
	} catch (err) {
		console.error(err);
		res.status(500).send({ status: 500, erro: "Erro ao buscar admins." });
	}
});


app.get("/getPlanoById/:idPlano", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idPlano } = req.params;

	const plano = await Planos.findOne({ where: { idPlano } });
	if (plano) {
		res.send({ status: 200, plano });
	} else {
		res.send({ status: 400, erro: 'Plano não encontrado.' });
	}
});

app.put("/atualizarPlano/:idPlano", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idPlano } = req.params;
	const { nomePlano, vlAntigo, vlNovo, percentual, descricao } = req.body;

	const plano = await Planos.findOne({ where: { idPlano } });
	if (!plano) return res.send({ status: 400, erro: 'Plano não encontrado.' });

	const AtualizarPlano = await Planos.update({ nome: nomePlano, valorAntigoMensal: vlAntigo, valorNovoMensal: vlNovo, descontoMensal: parseInt(percentual), descricao }, { where: { idPlano } });

	if (AtualizarPlano[0] === 1) {
		res.send({ status: 200, mensagem: 'Plano atualizado com sucesso.' });
	} else {
		res.send({ status: 400, erro: 'Erro ao atualizar plano.' });
	}
});

app.get("/listarTermos", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const termos = await TermosDeUso.findAll();
	if (termos) {
		res.send({ status: 200, termos });
	} else {
		res.send({ status: 400, erro: 'Nenhum termo encontrado.' });
	}
});

app.post("/adicionarTermo", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { conteudo, versao } = req.body;

	const termos = await TermosDeUso.create({ Conteudo: conteudo, Versao: versao });

	if (!termos) {
		res.send({ status: 400, erro: 'Erro ao adicionar termo.' });
	}

	res.send({ status: 200, mensagem: 'Termo adicionado com sucesso.' });
});

app.get("/listarDescontos", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const descontos = await Descontos.findAll();
	if (descontos) {
		res.send({ status: 200, descontos });
	} else {
		res.send({ status: 400, erro: 'Nenhum desconto encontrado.' });
	}
});

app.get("/getTermoById/:idTermo", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idTermo } = req.params;

	const termo = await TermosDeUso.findOne({ where: { idTermo } });
	if (termo) {
		res.send({ status: 200, termo });
	} else {
		res.send({ status: 400, erro: 'Termo não encontrado.' });
	}
});

app.put("/atualizarTermo/:idTermo", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idTermo } = req.params;
	const { conteudo, versao } = req.body;

	const termo = await TermosDeUso.findOne({ where: { idTermo } });
	if (!termo) return res.send({ status: 400, erro: 'Termo não encontrado.' });

	const AtualizarTermo = await TermosDeUso.update({ Conteudo: conteudo, Versao: versao }, { where: { idTermo } });

	if (AtualizarTermo[0] === 1) {
		res.send({ status: 200, mensagem: 'Termo atualizado com sucesso.' });
	} else {
		res.send({ status: 400, erro: 'Erro ao atualizar termo.' });
	}
});

app.get("/getDescontoById/:idDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idDesconto } = req.params;

	const desconto = await Descontos.findOne({ where: { idDesconto } });
	if (desconto) {
		res.send({ status: 200, desconto });
	} else {
		res.send({ status: 400, erro: 'Desconto não encontrado.' });
	}
});

app.put("/atualizarDesconto/:idDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idDesconto } = req.params;
	const { discountCode, valorDesconto, duracaoMeses } = req.body;

	const desconto = await Descontos.findOne({ where: { idDesconto } });
	if (!desconto) return res.send({ status: 400, erro: 'Desconto não encontrado.' });

	const AtualizarDesconto = await Descontos.update({ discountCode, valorDesconto, duracaoMeses }, { where: { idDesconto } });

	if (AtualizarDesconto[0] === 1) {
		res.send({ status: 200, mensagem: 'Desconto atualizado com sucesso.' });
	} else {
		res.send({ status: 400, erro: 'Erro ao atualizar desconto.' });
	}
});

app.post("/adicionarDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { discountCode, valorDesconto, duracaoMeses } = req.body;

	if (!discountCode || !valorDesconto) {
		return res.send({ status: 400, erro: 'Dados inválidos.' });
	}

	try {
		const novoDesconto = await Descontos.create({ discountCode: discountCode.toUpperCase(), valorDesconto, duracaoMeses, status: true });
		res.send({ status: 200, mensagem: 'Desconto adicionado com sucesso.', desconto: novoDesconto });
	} catch (error) {
		console.log(error);
		res.send({ status: 400, erro: 'Erro ao adicionar desconto.' });
	}
});

app.put("/desabilitarDesconto/:idDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idDesconto } = req.params;

	const desconto = await Descontos.findOne({ where: { idDesconto } });
	if (!desconto) return res.send({ status: 400, erro: 'Desconto não encontrado.' });

	const AtualizarDesconto = await Descontos.update({ status: false }, { where: { idDesconto } });

	if (AtualizarDesconto[0] === 1) {
		const descontos = await Descontos.findAll();
		res.send({ status: 200, mensagem: 'Desconto desabilitado com sucesso.', descontos });
	} else {
		res.send({ status: 400, erro: 'Erro ao desabilitar desconto.' });
	}
});

app.put("/habilitarDesconto/:idDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idDesconto } = req.params;

	const desconto = await Descontos.findOne({ where: { idDesconto } });
	if (!desconto) return res.send({ status: 400, erro: 'Desconto não encontrado.' });

	const AtualizarDesconto = await Descontos.update({ status: true }, { where: { idDesconto } });

	if (AtualizarDesconto[0] === 1) {
		const descontos = await Descontos.findAll();
		res.send({ status: 200, mensagem: 'Desconto habilitado com sucesso.', descontos });
	} else {
		res.send({ status: 400, erro: 'Erro ao habilitar desconto.' });
	}
});

app.get("/getDescontosUsados/:idDesconto", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idDesconto } = req.params;

	const response = await DescontosUsados.findAll(
		{
			include: [{
				model: Descontos,
				attributes: ["idDesconto", "discountCode", "valorDesconto"]
			}, {
				model: Usuario,
				attributes: ["idUsuario", "Nome", "Email", "Telefone"]
			}],
			where: { idDesconto }
		});
	console.log(response)
	if (response) {
		res.send({ status: 200, descontosUsados: response });
	} else {
		res.send({ status: 400, erro: 'Nenhum desconto usado encontrado.' });
	}
});

app.get("/listarAssinaturas", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const assinaturas = await Assinaturas.findAll({
		include: [
			{
				model: Usuario,
				attributes: ["idUsuario", "Nome"],
			},
			{
				model: Planos,
				attributes: ["idPlano", "nome"],
			},
		],
	});

	if (assinaturas) {
		res.send({ status: 200, assinaturas });
	} else {
		res.send({ status: 400, erro: 'Nenhuma assinatura encontrada.' });
	}
});

sequelize.sync().then(() => {
	console.log('Tabelas sincronizadas com sucesso.');
	server.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}`);
	});
}).catch(err => { console.error('Erro ao sincronizar o banco:', err); });
