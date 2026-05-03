const express = require("express");
const router = express.Router();
const db = require("../models/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const autenticar = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "segredo_dev";

// ── Nodemailer ────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── helper ────────────────────────────────────────────────────────────────────
function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/registro
// ─────────────────────────────────────────────────────────────────────────────
router.post("/registro", async (req, res) => {
  const { nome, email, telefone, pix_receber, senha } = req.body;

  if (!nome || !email || !telefone || !pix_receber || !senha) {
    return res.status(400).json({ error: "Preencha todos os campos" });
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: "senha deve ter no mínimo 6 caracteres" });
  }

  try {
    const [existe] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE email = ? OR nome = ?",
      [email, nome]
    );

    if (existe.length > 0) {
      return res.status(409).json({ error: "email ou nome já cadastrado" });
    }

    const hash = await bcrypt.hash(senha, 10);

    const [result] = await db.query(
      `INSERT INTO usuarios (nome, email, telefone, pix_receber, senha)
       VALUES (?, ?, ?, ?, ?)`,
      [nome, email, telefone, pix_receber, hash]
    );

    return res.status(201).json({
      message: "Conta criada com sucesso!",
      id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/login
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Preencha todos os campos" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "email incorreto" });
    }

    const usuario = rows[0];
    const senhaOk = await bcrypt.compare(senha, usuario.senha);

    if (!senhaOk) {
      return res.status(401).json({ error: "senha incorreta" });
    }

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, email: usuario.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login realizado!",
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        pix_receber: usuario.pix_receber,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  return res.json({ message: "Logout realizado" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/usuarios/verificar-auth
// ─────────────────────────────────────────────────────────────────────────────
router.get("/verificar-auth", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ logado: false });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    return res.json({ logado: true, usuario: decoded });
  } catch {
    return res.status(401).json({ logado: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/usuarios/perfil  — rota autenticada
// ─────────────────────────────────────────────────────────────────────────────
router.get("/perfil", autenticar, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_usuario, nome, email, telefone, pix_receber
         FROM usuarios
        WHERE id_usuario = ?`,
      [req.usuario.id_usuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/recuperar-senha
// Gera código de 6 dígitos, salva em reset_token + reset_expires e envia email
// ─────────────────────────────────────────────────────────────────────────────
router.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Informe o email" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE email = ?",
      [email]
    );

    // Resposta genérica para não revelar se o email existe
    if (rows.length === 0) {
      return res.json({ message: "Se o email existir, um código será enviado" });
    }

    const codigo = gerarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.query(
      `UPDATE usuarios
          SET reset_token   = ?,
              reset_expires = ?
        WHERE email = ?`,
      [codigo, expira, email]
    );

    await transporter.sendMail({
      from: `"SortePremiada" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código de recuperação de senha",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:auto;">
          <h2 style="color:#7c3aed;">Recuperação de Senha</h2>
          <p>Seu código de verificação é:</p>
          <h1 style="letter-spacing:8px;color:#7c3aed;">${codigo}</h1>
          <p style="color:#888;">Válido por 15 minutos. Ignore se não solicitou.</p>
        </div>
      `,
    });

    return res.json({ message: "Se o email existir, um código foi enviado" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao enviar email" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/validar-codigo
// ─────────────────────────────────────────────────────────────────────────────
router.post("/validar-codigo", async (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  try {
    const [rows] = await db.query(
      `SELECT reset_token, reset_expires
         FROM usuarios
        WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "email não encontrado" });
    }

    const { reset_token, reset_expires } = rows[0];

    if (!reset_token) {
      return res.status(400).json({ error: "Nenhum código solicitado" });
    }

    if (new Date() > new Date(reset_expires)) {
      return res.status(400).json({ error: "Código expirado. Solicite um novo" });
    }

    if (codigo !== reset_token) {
      return res.status(400).json({ error: "Código incorreto" });
    }

    return res.json({ message: "Código válido" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/redefinir-senha
// ─────────────────────────────────────────────────────────────────────────────
router.post("/redefinir-senha", async (req, res) => {
  const { email, codigo, novaSenha } = req.body;

  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ error: "senha deve ter no mínimo 6 caracteres" });
  }

  try {
    const [rows] = await db.query(
      `SELECT reset_token, reset_expires
         FROM usuarios
        WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "email não encontrado" });
    }

    const { reset_token, reset_expires } = rows[0];

    if (!reset_token) {
      return res.status(400).json({ error: "Nenhum código solicitado" });
    }

    if (new Date() > new Date(reset_expires)) {
      return res.status(400).json({ error: "Código expirado. Solicite um novo" });
    }

    if (codigo !== reset_token) {
      return res.status(400).json({ error: "Código incorreto" });
    }

    const hash = await bcrypt.hash(novaSenha, 10);

    await db.query(
      `UPDATE usuarios
          SET senha         = ?,
              reset_token   = NULL,
              reset_expires = NULL
        WHERE email = ?`,
      [hash, email]
    );

    return res.json({ message: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao redefinir senha" });
  }
});

module.exports = router;