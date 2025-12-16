
const { Parser } = require('json2csv');

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
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const FormData = require("form-data");
const archiver = require('archiver');
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
const PORT = 3006;

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
const PoliticaDePrivacidade = require('./models/PoliticaDePrivacidade');
const Certificados = require('./models/Certificados');
const Empresas = require('./models/Empresas');
const Servicos = require('./models/Servico');
const NotasFiscais = require('./models/NotasFiscais');

const allowedOrigins = [
	"https://contblack.com.br",
	"https://www.contblack.com.br",
	"https://admin.contblack.com.br",
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:3002",
];

app.use(cors({
	origin: function (origin, callback) {
		if (!origin || allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const publicDir = path.join(__dirname, "nfse");
app.use("/arquivos", express.static(publicDir));

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

// Configura onde e como salvar o arquivo
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "uploads/"); // pasta onde o arquivo será salvo
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname)); // nome único
	},
});

// Cria o middleware de upload
const upload = multer({ storage });


app.get('/', async (req, res) => {
	console.log(`[START] GET / - params:`, req.params, '- query:', req.query);
	res.send("up");
	console.log(`[END] GET /`);
});

app.get('/download/pdf/:cnpj/:ano/:mes/:arquivo', (req, res) => {
	const { cnpj, ano, mes, arquivo } = req.params;
	const filePath = path.join(process.cwd(), "nfse", "pdf", cnpj, ano, mes, arquivo);

	res.download(filePath, arquivo, (err) => {
		if (err) {
			console.error("Erro ao enviar arquivo para download:", err);
			return res.status(404).send("Arquivo não encontrado");
		}
	});
});


app.post("/contblackWebHook", async (req, res) => {
	try {
		const body = req.body;
		console.log("Webhook recebido:", body);

		if (!body.idIntegracao) {
			return res.status(400).json({ erro: "Campo idIntegracao ausente." });
		}
		if (!body.emissao) {
			return res.status(400).json({ erro: "Campo emissao ausente." });
		}

		const [dia, mes, ano] = body.emissao.split("/");

		const xmlDir = path.join(__dirname, "nfse", "xml", body.prestador, ano, mes);
		const pdfDir = path.join(__dirname, "nfse", "pdf", body.prestador, ano, mes);
		fs.mkdirSync(xmlDir, { recursive: true });
		fs.mkdirSync(pdfDir, { recursive: true });

		const downloadFile = async (url, dest) => {
			try {
				const response = await axios.get(url, {
					responseType: "stream",
					headers: { "x-api-key": process.env.PLUGNOTAS_API_KEY },
				});
				const writer = fs.createWriteStream(dest);
				response.data.pipe(writer);
				await new Promise((resolve, reject) => {
					writer.on("finish", resolve);
					writer.on("error", reject);
				});
				console.log(`Arquivo salvo: ${dest}`);
			} catch (err) {
				console.error(`Erro ao baixar arquivo de ${url}:`, err.message);
			}
		};

		let relativeXmlPath = null;
		let relativePdfPath = null;

		if (body.situacao === "CONCLUIDO" || body.situacao === "CANCELADO") {
			const numero = body.numeroNfse || body.numero || "sem-numero";

			const prefix = body.situacao === "CANCELADO" ? "CANCELADA_" : "";

			const xmlFileName = `${prefix}${numero}.xml`;
			const pdfFileName = `${prefix}${numero}.pdf`;

			const xmlPath = path.join(xmlDir, xmlFileName);
			const pdfPath = path.join(pdfDir, pdfFileName);

			relativeXmlPath = `/xml/${body.prestador}/${ano}/${mes}/${xmlFileName}`.replaceAll("\\", "/");
			relativePdfPath = `/pdf/${body.prestador}/${ano}/${mes}/${pdfFileName}`.replaceAll("\\", "/");

			if (body.xml) await downloadFile(body.xml, xmlPath);
			if (body.pdf) await downloadFile(body.pdf, pdfPath);
		}

		await NotasFiscais.update(
			{
				numeroNota: body.numeroNfse || null,
				status: body.situacao,
				dadosNFSe: body,
				caminhoXML: relativeXmlPath,
				caminhoPDF: relativePdfPath,
			},
			{ where: { idIntegracao: body.idIntegracao } }
		);

		console.log(`Nota ${body.idIntegracao} atualizada com status ${body.situacao}`);
		res.status(200).json({ mensagem: `Webhook recebido. Situação: ${body.situacao}` });

	} catch (error) {
		console.error("Erro ao processar webhook:", error);
		res.status(500).json({ erro: "Falha ao processar webhook" });
	}
});

app.get("/listarNotasFiscaisEmitidas", autenticarToken, async (req, res) => {
	const notasFiscais = await NotasFiscais.findAll({
		where: { idUsuario: req.usuario.id },
	});
	if (notasFiscais.length === 0) return res.send({ status: 400, mensagem: 'Nenhuma nota fiscal encontrada.' });
	res.send({ status: 200, notasFiscais });
});

app.post("/cancelarNotaFiscal", autenticarToken, async (req, res) => {
	const { idIntegracao } = req.body;

	if (!idIntegracao) {
		return res.status(400).send({ status: 400, mensagem: 'ID da nota fiscal é obrigatório.' });
	}

	const notaFiscal = await NotasFiscais.findOne({
		where: { idIntegracao, idUsuario: req.usuario.id },
	});
	if (!notaFiscal) return res.send({ status: 400, mensagem: 'Nenhuma nota fiscal encontrada.' });

	console.log("Nota Fiscal encontrada:", notaFiscal.dataValues.dadosNFSe.id);

	const url = `${process.env.PLUGNOTAS_API_URL}/nfse/cancelar/${notaFiscal.dataValues.dadosNFSe.id}`;
	const headers = {
		"Content-Type": "application/json",
		"x-api-key": process.env.PLUGNOTAS_API_KEY,
	};
	const body = {};

	try {
		const response = await axios.post(url, body, { headers });
		console.log("Resposta do PlugNotas:", response.data);

		await NotasFiscais.update(
			{ status: 'Pedido de Cancelamento' },
			{ where: { idIntegracao: notaFiscal.idIntegracao } }
		);

		res.send({ status: 200, mensagem: 'Solicitação de cancelamento recebida.' });
	} catch (error) {

		console.error("Erro ao cancelar nota fiscal:", error.response?.data || error.message);
		res.status(500).send({ status: 500, mensagem: 'Erro ao cancelar nota fiscal.' });
	}
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
			host: "mail.contblack.com.br",
			port: 465,
			secure: true,
			auth: {
				user: "contblack@contblack.com.br",
				pass: process.env.EMAIL_PASS,
			},
		});

		const link = `${process.env.URL_FRONTEND}/resetarSenha?token=${token}`;

		// Envio do e-mail HTML
		await transporter.sendMail({
			from: '"ContBlack" <contblack@contblack.com.br>',
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
										<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Contblack</h1>
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
										<p style="margin-top: 20px;">Atenciosamente,<br><strong>Equipe Contblack</strong></p>
									</td>
								</tr>
								<tr>
									<td align="center" style="background-color: #f4f4f4; padding: 15px; font-size: 12px; color: #666666;">
										<p>© ${new Date().getFullYear()} Contblack. Todos os direitos reservados.</p>
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
		return res.send({ status: 400, mensagem: "Algo deu errado." });
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

	const result = await sendEmail(email, "Contblack valide seu cadastro", `Seu código de confirmação é:`, codigo);

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
			// Atualiza se já existir
			lead = await Lead.findByPk(idLead);

			if (lead) {
				await Lead.update({
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
			// Cria novo lead
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

app.post("/aplicarDesconto", autenticarToken, async (req, res) => {
	try {
		let { codigo } = req.body;

		if (!codigo || codigo.trim() === "") {
			return res.send({ mensagem: "Código de desconto inválido.", status: 400 });
		}

		codigo = codigo.trim().toUpperCase();
		console.log("Código recebido:", codigo);

		const desconto = await Descontos.findOne({
			where: { status: true, discountCode: codigo }
		});

		if (!desconto) {
			return res.send({ mensagem: "Desconto inválido.", status: 400 });
		}

		return res.send({
			status: 200,
			mensagem: "Desconto aplicado com sucesso.",
			desconto
		});
	} catch (err) {
		console.error("Erro ao aplicar desconto:", err);
		return res.send({ mensagem: "Erro interno no servidor.", status: 400 });
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
	const url = `${process.env.URL_ASAAS}/v3/customers`;
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
		res.status(500).send({ status: 500, mensagem: 'Erro ao criar cliente no Asaas.' });
	}

	if (idAsaas) {
		try {
			// Busca o termo mais recente
			const termoAtual = await TermosDeUso.findOne({ order: [['DataCriacao', 'DESC']] });

			if (!termoAtual) {
				return res.send({ status: 400, mensagem: 'Nenhum termo de uso cadastrado no sistema.' });
			}
			console.log('Termo atual:', termoAtual);

			const politicaAtual = await PoliticaDePrivacidade.findOne({ order: [['DataCriacao', 'DESC']] });

			if (!politicaAtual) {
				return res.send({ status: 400, mensagem: 'Nenhuma política de privacidade cadastrada no sistema.' });
			}

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
				idTermo: termoAtual.idTermo,
				idPolitica: politicaAtual.idPolitica,
				DataConcordancia: new Date(),
				Revogado: false,
				DataRevogacao: null
			});

			if (!consentimentoResponse) {
				return res.send({ status: 400, mensagem: 'Erro ao registrar consentimento.' });
			}

			console.log('Consentimento registrado no banco de dados.');

			res.send({ status: 200, mensagem: 'Usuário cadastrado e consentimento registrado.' });
		} catch (err) {
			res.send({ status: 400, mensagem: 'Erro ao cadastrar usuário e registrar consentimento.' });
		}
	} else {
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
	const url = `${process.env.URL_ASAAS}/v3/subscriptions`;
	const headers = {
		'accept': 'application/json',
		'content-type': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const body = {
		billingType: metodo,
		cycle: 'MONTHLY',
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
		description: `CONTBLACK Assinatura do Plano - ${titulo}` || 'CONTBLACK Assinatura do Plano',
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
			periodicidade: periodicidade === "mensal" ? "MENSAL" : "ANUAL",
			dataInicio: new Date(),
			dataFim: null,
			proximaCobranca: response.data.nextDueDate || null,
			ultimaCobranca: null
		});

		// let urlKommo = `${process.env.URL_KOMMO}/api/v4/leads/${usuario.idKommo}`;

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


app.post("/alterarMetodoPagamento", autenticarToken, async (req, res) => {
	const { idAssinatura, idCustomer, value, description, nextDueDate, metodoPagamento, cardData } = req.body;

	const usuario = await Usuario.findOne({ where: { idUsuario: req.usuario.id } });
	const endereco = await Endereco.findOne({ where: { idUsuario: req.usuario.id } });

	let url = `${process.env.URL_ASAAS}/v3/subscriptions`;
	const headers = {
		'accept': 'application/json',
		'content-type': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const body = {
		billingType: metodoPagamento,
		cycle: 'MONTHLY',
		customer: idCustomer,
		value: value,
		nextDueDate: nextDueDate,
		discount: {
			value: 0,
			dueDateLimitDays: 0,
			type: 'PERCENTAGE'
		},
		interest: { value: 0 },
		fine: { value: 0, type: 'FIXED' },
		description: description || 'CONTBLACK Assinatura do Plano',

		endDate: null,
		maxPayments: null,
		externalReference: null,
		updatePendingPayments: true
	};

	if (metodoPagamento === 'CREDIT_CARD') {
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

	try {
		const response = await axios.post(url, body, { headers });
		console.log(response)
		if (response.data && response.data.id) {
			let urlDelete = `${process.env.URL_ASAAS}/v3/subscriptions/${idAssinatura}`;
			const responseDelete = await axios.delete(urlDelete, { headers });
			if (responseDelete.status === 200) {
				Assinaturas.update({
					idAssinaturaAsaas: response.data.id,
					status: response.data.status?.toUpperCase() || 'PENDENTE',
					metodoPagamento
				}, {
					where: {
						idUsuario: req.usuario.id
					}
				});
			}
		}
		res.send({ status: 200, data: response.data });
	} catch (error) {
		res.send({ status: 400, erro: 'Erro ao alterar método de pagamento.' });
		console.error(error);
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
	const usuario = await Usuario.findOne({ where: { idUsuario: id } });

	const url = `${process.env.URL_ASAAS}/v3/payments?customer=${usuario.idAsaas}`;

	const headers = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const response = await axios.get(url, { headers });

	let pagas = [];

	for (let fatura of response.data.data) {
		const status = fatura.status;

		if (['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED'].includes(status)) {
			pagas.push(fatura);
		}
	}

	const urlAssinatura = `${process.env.URL_ASAAS}/v3/subscriptions/${plano.idAssinaturaAsaas}`;
	const headersAssinatura = {
		accept: 'application/json',
		access_token: process.env.TOKEN_ASAAS
	}

	const responseAssinatura = await axios.get(urlAssinatura, { headers: headersAssinatura });

	res.send({ status: 200, pagamentos: pagas, assinatura: responseAssinatura.data });
});

app.post("/gerarContratoZapSign", autenticarToken, async (req, res) => {

	const { email } = req.body;

	const usuario = await Usuario.findOne({ where: { Email: email } });
	if (!usuario) {
		return res.send({ status: 400, mensagem: 'Usuário não encontrado.' });
	}

	const urlZapSign = `${process.env.URL_ZAPSIGN}/api/v1/docs/${process.env.TOKEN_CONTRATO_ZAPSIGN}/add-signer/`;
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

	const urlZapSign = `${process.env.URL_ZAPSIGN}/api/v1/signers/${response.dataValues.TokenZapSign}`;
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

	const urlAssas = `${process.env.URL_ASAAS}/v3/subscriptions/${assinaturaAtual.idAssinaturaAsaas}`;
	const headersAssas = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS,
		'content-type': 'application/json'
	};
	const bodyAssas = {
		value: plano.valorNovoMensal,
		description: `CONTBLACK Assinatura do Plano - ${plano.nome}`,
	}

	const responseAssas = await axios.put(urlAssas, bodyAssas, { headers: headersAssas });
	if (responseAssas.status !== 200) {
		return res.send({ status: 400, mensagem: 'Erro ao atualizar assinatura no Asaas.' });
	}

	// Atualiza o plano do usuário
	await Assinaturas.update({ idPlano: idPlanoEscolhido }, { where: { idUsuario: req.usuario.id } });

	res.send({ status: 200, mensagem: 'Plano alterado com sucesso.' });
});

app.get("/getCertificado", autenticarToken, async (req, res) => {
	const { id } = req.usuario;

	const certificado = await Certificados.findOne({ where: { idUsuario: id } });
	if (!certificado) {
		return res.send({ status: 400, mensagem: 'Certificado não encontrado.' });
	}
	res.send({ status: 200, certificado });
});

app.post("/adicionarServico", autenticarToken, async (req, res) => {
	const { codigo, codigoTributacao, discriminacao, cnae } = req.body;

	const servico = await Servicos.create({
		idUsuario: req.usuario.id,
		codigo,
		codigoTributacao,
		discriminacao,
		cnae,
	});
	if (!servico) {
		return res.send({ status: 400, mensagem: 'Erro ao adicionar serviço.' });
	}
	res.send({ status: 200, mensagem: 'Serviço adicionado com sucesso.', servico });
});

app.get("/listarServicos", autenticarToken, async (req, res) => {
	const servicos = await Servicos.findAll({ where: { idUsuario: req.usuario.id } });
	if (!servicos) {
		return res.send({ status: 400, mensagem: 'Nenhum serviço encontrado.' });
	}
	res.send({ status: 200, servicos });
});

app.get("/buscarServicoById/:idServico", autenticarToken, async (req, res) => {
	const { idServico } = req.params;
	const servico = await Servicos.findOne({ where: { idServico, idUsuario: req.usuario.id } });
	if (!servico) {
		return res.send({ status: 400, mensagem: 'Serviço não encontrado.' });
	}
	res.send({ status: 200, servico });
});

app.delete("/excluirServico/:idServico", autenticarToken, async (req, res) => {
	const { idServico } = req.params;

	const servico = await Servicos.findOne({ where: { idServico, idUsuario: req.usuario.id } });
	if (!servico) {
		return res.send({ status: 400, mensagem: 'Serviço não encontrado.' });
	}

	await Servicos.destroy({ where: { idServico } });
	res.send({ status: 200, mensagem: 'Serviço deletado com sucesso.' });
});

app.put("/editarServico/:idServico", autenticarToken, async (req, res) => {
	const { idServico } = req.params;
	const { codigo, discriminacao, cnae } = req.body;

	const servico = await Servicos.findOne({ where: { idServico, idUsuario: req.usuario.id } });
	if (!servico) {
		return res.send({ status: 400, mensagem: 'Serviço não encontrado.' });
	}

	await Servicos.update({
		codigo,
		codigoTributacao: codigo,
		discriminacao,
		cnae,
	}, { where: { idServico } });

	res.send({ status: 200, mensagem: 'Serviço atualizado com sucesso.' });
});

app.post("/emitirNotaServico", autenticarToken, async (req, res) => {
	try {
		const {
			cpfCnpjTomador,
			razaoSocialTomador,
			emailTomador,
			inscricaoMunicipalTomador,
			cepTomador,
			enderecoTomador,
			numeroTomador,
			estadoTomador,
			cidadeTomador,
			bairroTomador,
			servicoSelecionado,
			tipoTributacao,
			exigibilidade,
			aliquota,
			valorServico,
			descontoCondicionado,
			descontoIncondicionado,
			hasTomador,
		} = req.body;

		// Buscar a assinatura ativa do usuário
		const assinatura = await Assinaturas.findOne({
			where: { idUsuario: req.usuario.id, status: "ACTIVE" },
			include: Planos,
		});

		if (!assinatura) return res.status(400).json({ error: "Assinatura ativa não encontrada." });

		if (assinatura.dataValues.plano.dataValues.qtdNfseMensalUsuario !== -1) {
			// Contar notas emitidas no mês atual
			const hoje = new Date();
			const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
			const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

			const notasEsteMes = await NotasFiscais.count({
				where: {
					idUsuario: req.usuario.id,
					emitidaPor: req.usuario.id,
					dataEmissao: { [Op.between]: [primeiroDia, ultimoDia] },
				},
			});

			if (notasEsteMes >= assinatura.dataValues.plano.dataValues.qtdNfseMensalUsuario) {
				return res.send({ status: 400, error: "Limite de notas do mês atingido." });
			}
		}

		// Buscar prestador
		const prestador = await Empresas.findOne({ where: { idUsuario: req.usuario.id } });
		if (!prestador) return res.status(404).json({ error: "Prestador não encontrado." });

		const idIntegracao = Math.random().toString(36).substring(2, 15);
		// Montar corpo da nota
		const body = [];
		if (hasTomador) {
			// Buscar dados do CEP
			let infoCep = false;
			if (cepTomador) {
				infoCep = await axios.get(`${process.env.PLUGNOTAS_API_URL}/cep/${cepTomador}`, {
					headers: {
						accept: "application/json",
						"x-api-key": process.env.PLUGNOTAS_API_KEY,
					},
				});
			}
			body.push({
				idIntegracao,
				prestador: { cpfCnpj: prestador.dataValues.cnpj },
				tomador: {
					cpfCnpj: cpfCnpjTomador,
					razaoSocial: razaoSocialTomador,
					inscricaoMunicipal: inscricaoMunicipalTomador,
					email: emailTomador,
					endereco: {
						descricaoCidade: cidadeTomador,
						cep: cepTomador,
						tipoLogradouro: enderecoTomador?.split(" ")[0],
						logradouro: enderecoTomador?.slice(enderecoTomador.indexOf(" ") + 1),
						tipoBairro: "",
						codigoCidade: infoCep ? infoCep.data.ibge : "",
						complemento: "",
						estado: estadoTomador,
						numero: numeroTomador,
						bairro: bairroTomador,
					},
				},
				servico: {
					codigo: servicoSelecionado.codigo,
					codigoTributacao: servicoSelecionado.codigo,
					discriminacao: servicoSelecionado.discriminacao,
					cnae: servicoSelecionado.cnae,
					iss: {
						tipoTributacao: tipoTributacao,
						exigibilidade: exigibilidade,
						aliquota: aliquota,
					},
					valor: {
						servico: valorServico,
						descontoCondicionado: descontoCondicionado || 0,
						descontoIncondicionado: descontoIncondicionado || 0,
					},
				},
				enviarEmail: true,
			});
		} else {
			body.push({
				idIntegracao,
				prestador: { cpfCnpj: prestador.dataValues.cnpj },
				servico: {
					codigo: servicoSelecionado.codigo,
					codigoTributacao: servicoSelecionado.codigo,
					discriminacao: servicoSelecionado.discriminacao,
					cnae: servicoSelecionado.cnae,
					iss: {
						tipoTributacao: tipoTributacao,
						exigibilidade: exigibilidade,
						aliquota: aliquota,
					},
					valor: {
						servico: valorServico,
						descontoCondicionado: descontoCondicionado || 0,
						descontoIncondicionado: descontoIncondicionado || 0,
					},
				},
				enviarEmail: true,
			});
		}
		console.log("Corpo da requisição para PlugNotas:", JSON.stringify(body, null, 2));

		// Enviar nota para PlugNotas
		const url = `${process.env.PLUGNOTAS_API_URL}/nfse`;
		const headers = { "Content-Type": "application/json", "x-api-key": process.env.PLUGNOTAS_API_KEY };
		const response = await axios.post(url, body, { headers });

		// Salvar no banco
		await NotasFiscais.create({
			idUsuario: req.usuario.id,
			idIntegracao: idIntegracao,
			idAssinatura: assinatura.idAssinatura,
			emitidaPor: req.usuario.id,
			dataEmissao: new Date(),
			valor: valorServico,
			status: "PENDENTE",
			dadosNFSe: JSON.stringify(response.data) || null,
		});

		res.send({ status: 200, data: response.data });

	} catch (error) {
		console.error("Erro ao emitir NFS-e:", error);
		if (error.response) return res.status(error.response.status).json(error.response.data);
		res.send({ status: 400, error: "Erro interno ao emitir nota." });
	}
});

app.post("/dashboard", autenticarToken, async (req, res) => {
	const { email } = req.body;

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

			const urlAssas = `${process.env.URL_ASAAS}/v3/subscriptions/${assinatura.idAssinaturaAsaas}`;
			const headersAssas = {
				'accept': 'application/json',
				'access_token': process.env.TOKEN_ASAAS,
				'content-type': 'application/json'
			};
			const bodyAssas = {
				value: assinatura.periodicidade === "MENSAL" ? plano.valorNovoMensal : plano.valorNovoAnual,
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


	const tokenZapSign = await Usuario.findOne({ where: { Email: email }, attributes: ["TokenZapSign"] });

	const urlZapSign = `${process.env.URL_ZAPSIGN}/api/v1/signers/${tokenZapSign.dataValues.TokenZapSign}`;
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

	const servicos = await Servicos.findAll({ where: { idUsuario: usuario.idUsuario } });

	if (!servicos) return res.send({ status: 400, mensagem: 'Serviços não encontrados.' });

	let empresa = await Empresas.findOne({ where: { idUsuario: usuario.idUsuario } });
	if (!empresa) empresa = false;

	const assinaturas = await Assinaturas.findOne({ where: { idUsuario: usuario.idUsuario } });

	if (!assinaturas) return res.send({ status: 400, mensagem: 'Assinaturas não encontradas.' });

	// Contar notas emitidas no mês atual
	const hoje = new Date();
	const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0);
	const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

	const notasEsteMes = await NotasFiscais.count({
		where: {
			idUsuario: req.usuario.id,
			emitidaPor: req.usuario.id,
			dataEmissao: { [Op.between]: [primeiroDia, ultimoDia] },
		},
	});

	const notasEmitidas = await NotasFiscais.count({
		where: {
			idUsuario: req.usuario.id,
		},
	});

	console.log(hoje);
	console.log(primeiroDia);
	console.log(ultimoDia);

	const plano = await Planos.findOne({ where: { idPlano: assinaturas.idPlano } });

	const url = `${process.env.URL_ASAAS}/v3/payments?customer=${usuario.idAsaas}`;

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
			let dataVencimento = new Date(fatura.dueDate);
			let hoje = new Date();
			let diferencaEmDias = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24)); // Cálculo da diferença em dias

			// Se a fatura vencer em 10 dias ou menos, considera como pendente
			if (diferencaEmDias <= 10) {
				pendentes.push(fatura);
			}
		} else if (['OVERDUE', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED'].includes(status)) {
			vencidas.push(fatura);
		} else if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS'].includes(status)) {
			reembolsadas.push(fatura);
		} else if (['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(status)) {
			chargebacks.push(fatura);
		}
	}

	const urlAssinaturaAsaas = `${process.env.URL_ASAAS}/v3/subscriptions/${assinaturas.dataValues.idAssinaturaAsaas}`;

	const headersAssinaturaAsaas = {
		'accept': 'application/json',
		'access_token': process.env.TOKEN_ASAAS
	};

	const responseAssinaturaAsaas = await axios.get(urlAssinaturaAsaas, { headers: headersAssinaturaAsaas });

	let certificado = false;
	const responseCertificado = await Certificados.findOne({ where: { idUsuario: usuario.idUsuario } });
	if (responseCertificado) {
		certificado = responseCertificado.dataValues;
	}
	const objeto = {
		usuario: usuario.dataValues,
		assinatura: assinaturas.dataValues,
		plano: plano.dataValues,
		servicos: servicos,
		empresa: empresa ? empresa.dataValues : false,
		notasEmitidasEsteMes: notasEsteMes,
		totalNotasEmitidas: notasEmitidas,
		faturas: {
			pagas,
			pendentes,
			vencidas,
			reembolsadas,
			chargebacks
		},
		zapSign: responseZapSign.data,
		endereco: endereco.dataValues,
		asaas: responseAssinaturaAsaas.data,
		certificado: certificado || false
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

	const urlAssas = `${process.env.URL_ASAAS}/v3/subscriptions/${idAssinaturaAsaas}`;
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

app.post("/salvarDadosEmpresaADM", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	try {
		const { objetoPlugNotas, idUsuario } = req.body;

		const certificado = await Certificados.findOne({ where: { idUsuario: idUsuario } });
		if (!certificado) {
			return res.status(400).send({ mensagem: 'Certificado não encontrado. Faça o upload do certificado antes de salvar os dados da empresa.' });
		}

		objetoPlugNotas.certificado = certificado.dataValues.idCertificadoPlugNotas;

		const hasEmpresa = await Empresas.findOne({ where: { idUsuario: idUsuario } });

		const url = hasEmpresa
			? `${process.env.PLUGNOTAS_API_URL}/empresa/${hasEmpresa.dataValues.cnpj}`
			: `${process.env.PLUGNOTAS_API_URL}/empresa`;

		const headers = {
			'Content-Type': 'application/json',
			'x-api-key': process.env.PLUGNOTAS_API_KEY
		};

		console.log("Enviando para PlugNotas:", JSON.stringify(objetoPlugNotas, null, 2));

		const response = await axios({
			method: hasEmpresa ? 'patch' : 'post',
			url,
			headers,
			data: objetoPlugNotas
		});

		console.log("Retorno PlugNotas:", response.data);

		if (response.status === 200 || response.status === 201) {
			let objetoEmpresa = {
				cnpj: objetoPlugNotas.cpfCnpj,
				inscricaoEstadual: objetoPlugNotas.inscricaoEstadual,
				inscricaoMunicipal: objetoPlugNotas.inscricaoMunicipal,
				razaoSocial: objetoPlugNotas.razaoSocial,
				nomeFantasia: objetoPlugNotas.nomeFantasia,
				certificado: objetoPlugNotas.certificado,
				simplesNacional: objetoPlugNotas.simplesNacional,
				regimeTributario: objetoPlugNotas.regimeTributario,
				incentivoFiscal: objetoPlugNotas.incentivoFiscal,
				incentivadorCultural: objetoPlugNotas.incentivadorCultural,
				regimeTributarioEspecial: objetoPlugNotas.regimeTributarioEspecial,
				cep: objetoPlugNotas.endereco.cep,
				tipoLogradouro: objetoPlugNotas.endereco.tipoLogradouro,
				logradouro: objetoPlugNotas.endereco.logradouro,
				numero: objetoPlugNotas.endereco.numero,
				estado: objetoPlugNotas.endereco.estado,
				cidade: objetoPlugNotas.endereco.descricaoCidade,
				bairro: objetoPlugNotas.endereco.bairro,
				email: objetoPlugNotas.email,
				telefone: objetoPlugNotas.telefone.ddd + objetoPlugNotas.telefone.numero,
				gerarFaturas: false
			};

			if (hasEmpresa) {
				await Empresas.update(objetoEmpresa, { where: { idUsuario: idUsuario } });
			} else {
				await Empresas.create({ ...objetoEmpresa, idUsuario: idUsuario });
			}
		}

		res.send({ status: 200, mensagem: 'Dados da empresa salvos com sucesso.', data: response.data });
	}
	catch (error) {
		console.error("Erro ao salvar dados da empresa:", error.response?.data || error.message);
		res.send({ status: 500, mensagem: 'Erro ao salvar dados da empresa.', detalhes: error.response?.data || error.message });
	}
});

app.post("/emitirNotaServicoADM", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });
	console.log(req.body)

	try {
		const {
			cpfCnpjTomador,
			razaoSocialTomador,
			emailTomador,
			inscricaoMunicipalTomador,
			cepTomador,
			enderecoTomador,
			numeroTomador,
			estadoTomador,
			cidadeTomador,
			bairroTomador,
			servicoSelecionado,
			tipoTributacao,
			exigibilidade,
			aliquota,
			valorServico,
			descontoCondicionado,
			descontoIncondicionado,
			hasTomador,
			idUsuario
		} = req.body;

		// Buscar a assinatura ativa do usuário
		const assinatura = await Assinaturas.findOne({
			where: { idUsuario: idUsuario, status: "ACTIVE" },
			include: Planos,
		});

		if (!assinatura) return res.send({ status: 400, error: "Assinatura ativa não encontrada." });

		if (assinatura.dataValues.plano.dataValues.qtdNfseMensalClarea !== -1) {
			// Contar notas emitidas no mês atual
			const hoje = new Date();
			const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
			const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

			const notasEsteMes = await NotasFiscais.count({
				where: {
					idUsuario: req.usuario.id,
					emitidaPor: {
						[Op.ne]: req.usuario.id, // diferente do usuário atual
					},
					dataEmissao: {
						[Op.between]: [primeiroDia, ultimoDia], // dentro do mês atual
					},
				},
			});

			if (notasEsteMes >= assinatura.dataValues.plano.dataValues.qtdNfseMensalClarea) {
				return res.send({ status: 400, error: "Limite de notas do mês atingido." });
			}
		}

		// Buscar prestador
		const prestador = await Empresas.findOne({ where: { idUsuario: idUsuario } });
		if (!prestador) return res.send({ status: 400, error: "Prestador não encontrado." });
		console.log(prestador.dataValues);

		const idIntegracao = Math.random().toString(36).substring(2, 15);
		// Montar corpo da nota
		const body = [];
		if (hasTomador) {
			// Buscar dados do CEP
			const infoCep = await axios.get(`${process.env.PLUGNOTAS_API_URL}/cep/${cepTomador}`, {
				headers: {
					accept: "application/json",
					"x-api-key": process.env.PLUGNOTAS_API_KEY,
				},
			});
			body.push({
				idIntegracao,
				prestador: { cpfCnpj: prestador.dataValues.cnpj },
				tomador: {
					cpfCnpj: cpfCnpjTomador,
					razaoSocial: razaoSocialTomador,
					inscricaoMunicipal: inscricaoMunicipalTomador,
					email: emailTomador,
					endereco: {
						descricaoCidade: cidadeTomador,
						cep: cepTomador,
						tipoLogradouro: enderecoTomador?.split(" ")[0],
						logradouro: enderecoTomador?.slice(enderecoTomador.indexOf(" ") + 1),
						tipoBairro: "",
						codigoCidade: infoCep.data.ibge,
						complemento: "",
						estado: estadoTomador,
						numero: numeroTomador,
						bairro: bairroTomador,
					},
				},
				servico: {
					codigo: servicoSelecionado.codigo,
					codigoTributacao: servicoSelecionado.codigo,
					discriminacao: servicoSelecionado.discriminacao,
					cnae: servicoSelecionado.cnae,
					iss: {
						tipoTributacao: tipoTributacao,
						exigibilidade: exigibilidade,
						aliquota: aliquota,
					},
					valor: {
						servico: valorServico,
						descontoCondicionado: descontoCondicionado || 0,
						descontoIncondicionado: descontoIncondicionado || 0,
					},
				},
				enviarEmail: true,
			});
		} else {
			body.push({
				idIntegracao,
				prestador: { cpfCnpj: prestador.dataValues.cnpj },
				servico: {
					codigo: servicoSelecionado.codigo,
					codigoTributacao: servicoSelecionado.codigo,
					discriminacao: servicoSelecionado.discriminacao,
					cnae: servicoSelecionado.cnae,
					iss: {
						tipoTributacao: tipoTributacao,
						exigibilidade: exigibilidade,
						aliquota: aliquota,
					},
					valor: {
						servico: valorServico,
						descontoCondicionado: descontoCondicionado || 0,
						descontoIncondicionado: descontoIncondicionado || 0,
					},
				},
				enviarEmail: true,
			});
		}

		// Enviar nota para PlugNotas
		const url = `${process.env.PLUGNOTAS_API_URL}/nfse`;
		const headers = { "Content-Type": "application/json", "x-api-key": process.env.PLUGNOTAS_API_KEY };
		const response = await axios.post(url, body, { headers });

		// Salvar no banco
		await NotasFiscais.create({
			idUsuario: idUsuario,
			idIntegracao: idIntegracao,
			idAssinatura: assinatura.idAssinatura,
			emitidaPor: req.usuario.id,
			dataEmissao: new Date(),
			valor: valorServico,
			status: "PENDENTE",
			dadosNFSe: JSON.stringify(response.data) || null,
		});

		res.send({ status: 200, data: response.data });

	} catch (error) {
		console.error("Erro ao emitir NFS-e:", error.response.data.error);
		res.send({ status: 400, error: "Erro interno ao emitir nota." });
	}
});

app.post("/adicionarServicoADM", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	console.log(req.body)
	const { codigo, discriminacao, cnae, idUsuario } = req.body;

	console.log(idUsuario)
	const servico = await Servicos.create({
		idUsuario: idUsuario,
		codigo,
		codigoTributacao: codigo,
		discriminacao,
		cnae,
	});
	if (!servico) {
		return res.send({ status: 400, mensagem: 'Erro ao adicionar serviço.' });
	}
	res.send({ status: 200, mensagem: 'Serviço adicionado com sucesso.', servico });
});


app.post("/uploadCertificadoADM", autenticarToken, upload.single("arquivo"), async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });


	const arquivo = req.file;
	const { senha, email, idUsuario } = req.body;
	console.log(idUsuario)

	if (!arquivo) return res.send({ status: 400, error: "Arquivo não enviado" });

	try {
		// Verifica se o usuário já possui certificado
		const certificadoExistente = await Certificados.findOne({ where: { idUsuario: idUsuario } });
		const possuiCertificado = !!certificadoExistente;

		// Define a URL da API
		const url = possuiCertificado
			? `${process.env.PLUGNOTAS_API_URL}/certificado/5bf94e0a4adcc00c28871999`
			: `${process.env.PLUGNOTAS_API_URL}/certificado`;

		// Cria FormData
		const formData = new FormData();
		formData.append("arquivo", fs.createReadStream(arquivo.path));
		formData.append("senha", senha);
		formData.append("email", email);

		// Faz upload (POST ou PUT)
		const response = possuiCertificado
			? await axios.put(url, formData, { headers: { ...formData.getHeaders(), "x-api-key": process.env.PLUGNOTAS_API_KEY } })
			: await axios.post(url, formData, { headers: { ...formData.getHeaders(), "x-api-key": process.env.PLUGNOTAS_API_KEY } });

		// Remove arquivo local
		if (fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
		console.log(response.data);
		if (response.status === 201) {
			// Salva o certificado no banco

			await Certificados.create({
				idUsuario: idUsuario,
				idCertificadoPlugNotas: response.data.data.id,
				arquivoNome: arquivo.originalname,
			});

			return res.send({ status: 200, mensagem: "Certificado enviado e salvo com sucesso.", data: response.data });
		} else if (response.status === 200) {
			// Atualiza o certificado no banco
			await Certificados.update(
				{ idCertificadoPlugNotas: response.data.data.id, arquivoNome: arquivo.originalname },
				{ where: { idUsuario: idUsuario } }
			);
			return res.send({ status: 200, mensagem: "Certificado atualizado e salvo com sucesso.", data: response.data, nomeArquivo: arquivo.originalname });
		}

		const hasEmpresa = await Empresas.findOne({ where: { idUsuario: idUsuario } });
		if (hasEmpresa) {
			await Empresas.update({ certificado: response.data.data.id }, { where: { idUsuario: idUsuario } });
		}
	} catch (error) {
		console.error("Erro no envio:", error.response?.data || error.message);

		// Garante remoção do arquivo mesmo em caso de erro
		if (arquivo.path && fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);

		return res.send({ status: 400, error: "Erro ao enviar certificado" });
	}
});

app.get("/getInfoPerfilUsuario/:idUsuario", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { idUsuario } = req.params;
	// const idUsuario = 1; // temporario para testes

	const usuario = await Usuario.findOne({ where: { idUsuario } });
	if (!usuario) return res.send({ status: 400, erro: 'Usuário não encontrado.' });

	const empresa = await Empresas.findOne({ where: { idUsuario } });
	const servicos = await Servicos.findAll({ where: { idUsuario } });
	const certificado = await Certificados.findOne({ where: { idUsuario } });
	const plano = await Assinaturas.findOne({ where: { idUsuario }, include: Planos });
	const notasEmitidasbyClarea = await NotasFiscais.count({
		where: {
			idUsuario: idUsuario,
			emitidaPor: {
				[Op.ne]: idUsuario, // diferente do idUsuario
			},
		},
	});

	const dados = {
		usuario: usuario.dataValues,
		empresa: empresa ? empresa.dataValues : false,
		servicos: servicos.map(servico => servico.dataValues),
		certificado: certificado ? certificado.dataValues : false,
		assinatura: plano ? plano.dataValues : false,
		notasEmitidasbyClarea
	}

	res.send({ status: 200, dados });
});

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

app.get("/buscarCnpj/:cnpj", autenticarToken, async (req, res) => {
	const { cnpj } = req.params;
	console.log("Buscando CNPJ:", cnpj);
	const url = `${process.env.PLUGNOTAS_API_URL}/cnpj/${cnpj}`;
	const headers = {
		'Content-Type': 'application/json',
		'x-api-key': process.env.PLUGNOTAS_API_KEY
	};

	try {
		const response = await axios.get(url, { headers });
		res.send({ status: 200, data: response.data });
	} catch (error) {
		console.error("Erro ao buscar CNPJ:", error.response ? error.response.data : error.message);
		res.send({ status: 400, erro: 'Erro ao buscar CNPJ.' });
	}
});

app.post("/salvarDadosEmpresa", autenticarToken, async (req, res) => {
	try {
		const { objetoPlugNotas, gerarFaturas } = req.body;

		const certificado = await Certificados.findOne({ where: { idUsuario: req.usuario.id } });
		if (!certificado) {
			return res.status(400).send({ mensagem: 'Certificado não encontrado. Faça o upload do certificado antes de salvar os dados da empresa.' });
		}

		objetoPlugNotas.certificado = certificado.dataValues.idCertificadoPlugNotas;

		const hasEmpresa = await Empresas.findOne({ where: { idUsuario: req.usuario.id } });

		const url = hasEmpresa
			? `${process.env.PLUGNOTAS_API_URL}/empresa/${hasEmpresa.dataValues.cnpj}`
			: `${process.env.PLUGNOTAS_API_URL}/empresa`;

		const headers = {
			'Content-Type': 'application/json',
			'x-api-key': process.env.PLUGNOTAS_API_KEY
		};

		console.log("Enviando para PlugNotas:", JSON.stringify(objetoPlugNotas, null, 2));

		const response = await axios({
			method: hasEmpresa ? 'patch' : 'post',
			url,
			headers,
			data: objetoPlugNotas
		});

		console.log("Retorno PlugNotas:", response.data);

		if (response.status === 200 || response.status === 201) {
			let objetoEmpresa = {
				cnpj: objetoPlugNotas.cpfCnpj,
				inscricaoEstadual: objetoPlugNotas.inscricaoEstadual,
				inscricaoMunicipal: objetoPlugNotas.inscricaoMunicipal,
				razaoSocial: objetoPlugNotas.razaoSocial,
				nomeFantasia: objetoPlugNotas.nomeFantasia,
				certificado: objetoPlugNotas.certificado,
				simplesNacional: objetoPlugNotas.simplesNacional,
				regimeTributario: objetoPlugNotas.regimeTributario,
				incentivoFiscal: objetoPlugNotas.incentivoFiscal,
				incentivadorCultural: objetoPlugNotas.incentivadorCultural,
				regimeTributarioEspecial: objetoPlugNotas.regimeTributarioEspecial,
				cep: objetoPlugNotas.endereco.cep,
				tipoLogradouro: objetoPlugNotas.endereco.tipoLogradouro,
				logradouro: objetoPlugNotas.endereco.logradouro,
				numero: objetoPlugNotas.endereco.numero,
				estado: objetoPlugNotas.endereco.estado,
				cidade: objetoPlugNotas.endereco.descricaoCidade,
				bairro: objetoPlugNotas.endereco.bairro,
				email: objetoPlugNotas.email,
				telefone: objetoPlugNotas.telefone.ddd + objetoPlugNotas.telefone.numero,
				gerarFaturas: gerarFaturas
			};

			if (hasEmpresa) {
				await Empresas.update(objetoEmpresa, { where: { idUsuario: req.usuario.id } });
			} else {
				await Empresas.create({ ...objetoEmpresa, idUsuario: req.usuario.id });
			}
			if (gerarFaturas) {
				const usuario = await Usuario.findByPk(req.usuario.id);
				const urlAssas = `${process.env.URL_ASAAS}/v3/customers/${usuario.idAsaas}`;
				const headersAssas = {
					'accept': 'application/json',
					'access_token': process.env.TOKEN_ASAAS,
					'content-type': 'application/json'
				};
				const bodyAssas = {
					cpfCnpj: objetoPlugNotas.cpfCnpj,
				}
				const responseAsaas = await axios.put(urlAssas, bodyAssas, { headers: headersAssas });
				console.log("Retorno Asaas:", responseAsaas.data);
			}
		}

		res.send({ status: 200, mensagem: 'Dados da empresa salvos com sucesso.', data: response.data });
	}
	catch (error) {
		console.error("Erro ao salvar dados da empresa:", error.response?.data || error.message);
		res.send({ status: 500, mensagem: 'Erro ao salvar dados da empresa.', detalhes: error.response?.data || error.message });
	}
});

app.get("/getDadosEmpresa", autenticarToken, async (req, res) => {
	try {
		const empresa = await Empresas.findOne({ where: { idUsuario: req.usuario.id } });
		if (!empresa) {
			return res.send({ status: 400, data: {}, mensagem: 'Empresa não encontrada.' });
		}
		res.send({ status: 200, data: empresa });
	} catch (error) {
		console.error("Erro ao buscar dados da empresa:", error.message);
		res.status(500).send({ status: 500, mensagem: 'Erro ao buscar dados da empresa.', detalhes: error.message });
	}
});

app.post("/uploadCertificado", autenticarToken, upload.single("arquivo"), async (req, res) => {
	const arquivo = req.file;
	const { senha, email } = req.body;

	if (!arquivo) return res.send({ status: 400, error: "Arquivo não enviado" });

	try {
		// Verifica se o usuário já possui certificado
		const certificadoExistente = await Certificados.findOne({ where: { idUsuario: req.usuario.id } });
		const possuiCertificado = !!certificadoExistente;

		// Define a URL da API
		const url = possuiCertificado
			? `${process.env.PLUGNOTAS_API_URL}/certificado/5bf94e0a4adcc00c28871999`
			: `${process.env.PLUGNOTAS_API_URL}/certificado`;

		// Cria FormData
		const formData = new FormData();
		formData.append("arquivo", fs.createReadStream(arquivo.path));
		formData.append("senha", senha);
		formData.append("email", email);

		// Faz upload (POST ou PUT)
		const response = possuiCertificado
			? await axios.put(url, formData, { headers: { ...formData.getHeaders(), "x-api-key": process.env.PLUGNOTAS_API_KEY } })
			: await axios.post(url, formData, { headers: { ...formData.getHeaders(), "x-api-key": process.env.PLUGNOTAS_API_KEY } });

		// Remove arquivo local
		if (fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
		console.log(response.data);
		if (response.status === 201) {
			// Salva o certificado no banco

			await Certificados.create({
				idUsuario: req.usuario.id,
				idCertificadoPlugNotas: response.data.data.id,
				arquivoNome: arquivo.originalname,
			});

			return res.send({ status: 200, mensagem: "Certificado enviado e salvo com sucesso.", data: response.data });
		} else if (response.status === 200) {
			// Atualiza o certificado no banco
			await Certificados.update(
				{ idCertificadoPlugNotas: response.data.data.id, arquivoNome: arquivo.originalname },
				{ where: { idUsuario: req.usuario.id } }
			);
			return res.send({ status: 200, mensagem: "Certificado atualizado e salvo com sucesso.", data: response.data, nomeArquivo: arquivo.originalname });
		}

		const hasEmpresa = await Empresas.findOne({ where: { idUsuario: req.usuario.id } });
		if (hasEmpresa) {
			await Empresas.update({ certificado: response.data.data.id }, { where: { idUsuario: req.usuario.id } });
		}
	} catch (error) {
		console.error("Erro no envio:", error.response?.data || error.message);

		// Garante remoção do arquivo mesmo em caso de erro
		if (arquivo.path && fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);

		return res.send({ status: 400, error: "Erro ao enviar certificado" });
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
			host: "mail.contblack.com.br",
			port: 465,
			secure: true,
			auth: {
				user: "contblack@contblack.com.br",
				pass: process.env.EMAIL_PASS,
			},
		});

		const link = `${process.env.URL_FRONTEND_ADM}/EsqueceuSenha?token=${token}`;

		// Envio do e-mail HTML diretamente aqui
		await transporter.sendMail({
			from: '"Contblack" <contblack@contblack.com.br>',
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
										<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Contblack</h1>
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
										<p style="margin-top: 20px;">Atenciosamente,<br><strong>Equipe Contblack</strong></p>
									</td>
								</tr>
								<tr>
									<td align="center" style="background-color: #f4f4f4; padding: 15px; font-size: 12px; color: #666666;">
										<p>© ${new Date().getFullYear()} Contblack. Todos os direitos reservados.</p>
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


app.get("/listarUsuariosEmitirNota", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: "Acesso negado." });

	try {
		const usuarios = await Usuario.findAll({
			include: [
				{
					model: Admins,
					attributes: ["idAdmin"],
					required: false,
				},
				{
					model: Empresas,
					as: "empresa", // se você definiu um alias no relacionamento, use aqui
					required: false, // mesmo que o usuário possa não ter empresa
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
	const { nome,
		valorAntigoMensal,
		valorNovoMensal,
		percentual,
		descricao,
		qtdNfseMensalUsuario,
		qtdNfseMensalClarea
	} = req.body;

	const plano = await Planos.findOne({ where: { idPlano } });
	if (!plano) return res.send({ status: 400, erro: 'Plano não encontrado.' });

	const AtualizarPlano = await Planos.update({
		nome,
		valorAntigoMensal,
		valorNovoMensal,
		descontoMensal: parseInt(percentual),
		descricao,
		qtdNfseMensalUsuario: parseInt(qtdNfseMensalUsuario),
		qtdNfseMensalClarea: parseInt(qtdNfseMensalClarea)
	}, { where: { idPlano } });

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

app.get('/listarPoliticas', autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const politicas = await PoliticaDePrivacidade.findAll();
	if (politicas) {
		res.send({ status: 200, politicas });
	} else {
		res.send({ status: 400, erro: 'Nenhuma política encontrada.' });
	}
})

app.get("/get/termos-uso", async (req, res) => {
	const termo = await TermosDeUso.findOne({
		order: [['idTermo', 'DESC']]
	});

	if (termo) {
		res.send({ status: 200, termo });
	} else {
		res.send({ status: 400, erro: 'Nenhum termo encontrado.' });
	}
});

app.get("/get/politicas-privacidade", async (req, res) => {
	const politica = await PoliticaDePrivacidade.findOne({
		order: [['idPolitica', 'DESC']]
	});

	if (politica) {
		res.send({ status: 200, politica });
	} else {
		res.send({ status: 400, erro: 'Nenhuma política encontrada.' });
	}
});

app.post("/adicionarTermo", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { content } = req.body;

	const termoMaisRecente = await TermosDeUso.findOne({
		order: [['idTermo', 'DESC']]
	});

	let novaVersao = termoMaisRecente ? Number(termoMaisRecente.Versao) + 1 : 1;

	const termos = await TermosDeUso.create({ Conteudo: content, Versao: novaVersao });

	if (!termos) {
		res.send({ status: 400, erro: 'Erro ao adicionar termo.' });
	}

	res.send({ status: 200, mensagem: 'Termo adicionado com sucesso.' });
});

app.post("/adicionarPolitica", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });

	const { content } = req.body;

	const politicaMaisRecente = await PoliticaDePrivacidade.findOne({
		order: [['idPolitica', 'DESC']]
	});
	let novaVersao = politicaMaisRecente ? Number(politicaMaisRecente.Versao) + 1 : 1;

	const politica = await PoliticaDePrivacidade.create({ Conteudo: content, Versao: novaVersao });

	if (!politica) {
		res.send({ status: 400, erro: 'Erro ao adicionar política.' });
	}

	res.send({ status: 200, mensagem: 'Política adicionada com sucesso.' });
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

	const response = await DescontosUsados.findAll({
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

app.get("/download/pdf/:cnpj", async (req, res) => {
	try {
		const { cnpj } = req.params;

		// Caminho da pasta desse CNPJ
		const folderPath = path.join(process.cwd(), "nfse", "pdf", cnpj);

		// Verifica se a pasta existe
		if (!fs.existsSync(folderPath)) {
			return res.status(404).send("❌ Pasta não encontrada.");
		}

		// Nome do arquivo ZIP final
		const zipName = `notas_${cnpj}_PDF.zip`;

		// Configura o cabeçalho HTTP para download
		res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
		res.setHeader("Content-Type", "application/zip");

		// Cria o ZIP e envia direto para o response
		const archive = archiver("zip", { zlib: { level: 9 } });
		archive.pipe(res);

		// Adiciona toda a pasta do CNPJ
		archive.directory(folderPath, false);

		// Finaliza o arquivo ZIP
		await archive.finalize();

		console.log(`📦 ZIP gerado e enviado: ${zipName}`);
	} catch (error) {
		console.error("🚨 Erro ao gerar ZIP:", error);
		res.status(500).send("Erro ao gerar o arquivo ZIP.");
	}
});


app.get("/download/xml/:cnpj", async (req, res) => {
	try {
		const { cnpj } = req.params;

		// Caminho da pasta desse CNPJ
		const folderPath = path.join(process.cwd(), "nfse", "xml", cnpj);

		// Verifica se a pasta existe
		if (!fs.existsSync(folderPath)) {
			return res.status(404).send("❌ Pasta não encontrada.");
		}

		// Nome do arquivo ZIP final
		const zipName = `notas_${cnpj}_XML.zip`;

		// Configura o cabeçalho HTTP para download
		res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
		res.setHeader("Content-Type", "application/zip");

		// Cria o ZIP e envia direto para o response
		const archive = archiver("zip", { zlib: { level: 9 } });
		archive.pipe(res);

		// Adiciona toda a pasta do CNPJ
		archive.directory(folderPath, false);

		// Finaliza o arquivo ZIP
		await archive.finalize();

		console.log(`📦 ZIP gerado e enviado: ${zipName}`);
	} catch (error) {
		console.error("🚨 Erro ao gerar ZIP:", error);
		res.status(500).send("Erro ao gerar o arquivo ZIP.");
	}
});

app.post("/api/salvarDadosLead", async (req, res) => {
	let { nome, email, telefone } = req.body;

	try {
		telefone = telefone.replace(/\D/g, "");

		const alreadyExists = await Lead.findOne({ where: { email } });
		if (alreadyExists) {
			return res.status(400).send({ status: 400, mensagem: 'E-mail já cadastrado, entraremos em contato em breve.' });
		}

		await Lead.create({
			nome,
			email,
			telefone,
			stepAtual: 100
		});
		return res.status(200).send({ status: 200, mensagem: 'Lead salvo com sucesso.' });
	} catch (error) {
		console.error("Erro ao salvar lead:", error.message);
		return res.status(500).send({ status: 500, mensagem: 'Ocorreu um erro, tente novamente mais tarde.', detalhes: error.message });
	}
});

app.get("/api/listarLeads", autenticarToken, async (req, res) => {
	const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
	if (!adm) return res.send({ status: 403, erro: 'Acesso negado.' });
	try {
		const leads = await Lead.findAll({ where: { stepAtual: 100 } });
		return res.send({ status: 200, leads });
	} catch (error) {
		console.error("Erro ao listar leads:", error.message);
		return res.send({ status: 500, mensagem: 'Ocorreu um erro, tente novamente mais tarde.', detalhes: error.message });
	}
});

app.get("/api/downloadCsv", autenticarToken, async (req, res) => {
	try {
		// Verifica se o usuário é admin
		const adm = await Admins.findOne({ where: { idUsuario: req.usuario.id } });
		if (!adm) return res.status(403).send({ status: 403, erro: "Acesso negado." });

		// Busca os dados que você quer exportar
		const leads = await Lead.findAll({
			where: { stepAtual: 100 },
			attributes: ["nome", "telefone", "email"]
		});

		if (!leads || leads.length === 0) {
			return res.status(404).send({ status: 404, erro: "Nenhum lead encontrado." });
		}

		// Converte os dados para CSV
		const jsonLeads = leads.map(lead => lead.toJSON());
		const parser = new Parser();
		const csv = parser.parse(jsonLeads);

		// Configura o response para download
		res.header("Content-Type", "text/csv");
		res.attachment("leads.csv"); // nome do arquivo
		return res.send(csv);

	} catch (error) {
		console.error(error);
		res.status(500).send({ status: 500, erro: "Erro ao gerar CSV." });
	}
});

sequelize.sync({ alter: true }).then(() => {
	console.log('Tabelas sincronizadas com sucesso.');
	server.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}`);
	});
}).catch(err => { console.error('Erro ao sincronizar o banco:', err); });
