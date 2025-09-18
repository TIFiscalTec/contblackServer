const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
	host: "mail.clareavital.com.br",
	port: 465,
	secure: true,
	auth: {
		user: "clareavital@clareavital.com.br",
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
			<body style="margin:0;padding:0;background:#f9f2e4;">
			<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f2e4;">
				<tr>
				<td align="center" style="padding:32px 12px;">
					<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);">
					
					<!-- header -->
					<tr>
						<td style="background:#0b243d;color:#ffffff;padding:28px 32px;font-family:Arial,Helvetica,sans-serif;">
						<div style="font-size:18px;letter-spacing:.4px;opacity:.9;">Clarea Vital</div>
						<div style="font-size:22px;font-weight:700;margin-top:4px;">${subject}</div>
						</td>
					</tr>

					<!-- conteúdo -->
					<tr>
						<td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:#0b243d;">
						<p style="margin:0 0 12px;font-size:16px;line-height:24px;">
							Olá!
						</p>
						<p style="margin:0 0 16px;font-size:16px;line-height:24px;">
							${text}
						</p>

						<!-- bloco de destaque -->
						<div style="margin:20px 0 8px;">
							<div style="display:inline-block;background:#f9f2e4;border:1px solid #ffc845;border-radius:12px;padding:14px 20px;font-family:'Courier New',monospace;font-weight:700;font-size:22px;letter-spacing:3px;color:#0b243d;">
							${codigo}
							</div>
						</div>

						<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#4a5568;">
							Se você não solicitou este e-mail, pode ignorá-lo com segurança.
						</p>
						</td>
					</tr>

					<!-- rodapé -->
					<tr>
						<td style="background:#f9f2e4;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px;line-height:18px;">
						<div>© ${new Date().getFullYear()} Clarea Vital • Todos os direitos reservados.</div>
						<div style="margin-top:4px;">Este é um e-mail automático, por favor não responda.</div>
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
			from: '"Clarea Vital" <clareavital@clareavital.com.br>',
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
