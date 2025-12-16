const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
	host: "mail.contblack.com.br",
	port: 465,
	secure: true,
	auth: {
		user: "contblack@contblack.com.br",
		pass: process.env.EMAIL_PASS,
	},
});

const sendEmail = async (to, subject, text, codigo) => {
	try {
		const html = `
				<!doctype html>
				<html lang="pt-BR">
				<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>${subject}</title>
				</head>
				<body style="margin:0;padding:0;background: #233344;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #233344;">
					<tr>
					<td align="center" style="padding:32px 12px;">
						<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background: #ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);">
						
						<!-- header -->
						<tr>
							<td style="background: #9C01B9;color:#ffffff;padding:28px 32px;font-family:Arial,Helvetica,sans-serif;">
							<div style="font-size:18px;letter-spacing:.4px;opacity:.9;">Contblack</div>
							<div style="font-size:22px;font-weight:700;margin-top:4px;">${subject}</div>
							</td>
						</tr>

						<!-- conteúdo -->
						<tr>
							<td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:#233344;">
							<p style="margin:0 0 12px;font-size:16px;line-height:24px;">
								Olá!
							</p>
							<p style="margin:0 0 16px;font-size:16px;line-height:24px;">
								${text}
							</p>

							<!-- bloco de destaque -->
							<div style="margin:20px 0 8px;">
								<div style="display:inline-block;background: #1EFF86;border:1px solid #9C01B9;border-radius:12px;padding:14px 20px;font-family:'Courier New',monospace;font-weight:700;font-size:22px;letter-spacing:3px;color:#233344;">
								${codigo}
								</div>
							</div>

							<p style="margin:20px 0 16px;font-size:16px;line-height:24px;">
								Se você não solicitou este e-mail, pode ignorá-lo com segurança.
							</p>
							</td>
						</tr>

						<!-- rodapé -->
						<tr>
							<td style="background: #9C01B9;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:12px;line-height:18px;">
							<div>© ${new Date().getFullYear()} Contblack • Todos os direitos reservados.</div>
							<div style="margin-top:4px; color: white">Este é um e-mail automático, por favor não responda.</div>
							</td>
						</tr>
						</table>
					</td>
					</tr>
				</table>
				</body>
				</html>
				`;


		const info = await transporter.sendMail({
			from: '"Contblack" <contblack@contblack.com.br>',
			to,
			subject,
			text,
			html, // aqui vai o html estilizado
		});

		console.log("E-mail enviado: %s", info.messageId);
		return { success: true, messageId: info.messageId };
	} catch (error) {
		console.error("Erro ao enviar e-mail:", error);
		return { success: false, error };
	}
};

module.exports = sendEmail;
