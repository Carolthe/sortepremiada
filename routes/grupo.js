const express = require("express");
const router = express.Router();
const db = require("../models/db");
const autenticar = require("../middleware/auth");

/* ─────────────────────────────────────────────
GET GRUPOS
───────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id_numeros_grupo,
        animal,
        imagem,
        numeros,
        status
      FROM grupo
      ORDER BY id_numeros_grupo
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      erro: "Erro ao buscar grupos",
    });
  }
});

/* ─────────────────────────────────────────────
CRIAR COMPRA + RESERVAR GRUPOS
───────────────────────────────────────────── */
router.post("/compras", autenticar, async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const {
      quantidade,
      valor,
      grupos,
    } = req.body;

    const id_usuario =
      req.usuario.id_usuario;

    if (
      !quantidade ||
      !valor ||
      !grupos ||
      grupos.length === 0
    ) {
      await conn.rollback();

      return res.status(400).json({
        erro: "Dados incompletos",
      });
    }

    /* verifica se existe grupo reservado */
    const placeholders = grupos
      .map(() => "?")
      .join(",");

    const [ocupados] = await conn.query(
      `
      SELECT
        id_numeros_grupo
      FROM grupo
      WHERE id_numeros_grupo IN (${placeholders})
      AND status <> 'disponivel'
      `,
      grupos
    );

    if (ocupados.length > 0) {
      await conn.rollback();

      return res.status(409).json({
        erro:
          "Um ou mais grupos já foram reservados ou vendidos.",
      });
    }

    /* cria compra */
    const [result] = await conn.query(
      `
      INSERT INTO compra_grupo
      (
        id_usuario,
        quantidade,
        valor
      )
      VALUES (?, ?, ?)
      `,
      [
        id_usuario,
        quantidade,
        valor,
      ]
    );

    const id_compra_grupo =
      result.insertId;

    /* salva animais da compra */
    for (const id_grupo of grupos) {
      await conn.query(
        `
        INSERT INTO animal_compra_grupo
        (
          id_compra_grupo,
          id_numeros_grupo,
          id_usuario
        )
        VALUES (?, ?, ?)
        `,
        [
          id_compra_grupo,
          id_grupo,
          id_usuario,
        ]
      );

      /* reserva grupo */
      await conn.query(
        `
        UPDATE grupo
        SET status = 'reservado'
        WHERE id_numeros_grupo = ?
        `,
        [id_grupo]
      );
    }

    await conn.commit();

    res.json({
      id_compra: id_compra_grupo,
    });
  } catch (error) {
    await conn.rollback();

    console.log(error);

    res.status(500).json({
      erro:
        "Erro ao criar compra do grupo",
    });
  } finally {
    conn.release();
  }
});

/* ─────────────────────────────────────────────
CONFIRMAR PAGAMENTO
───────────────────────────────────────────── */
router.post("/vender", async (req, res) => {
  const { id_grupo } = req.body;

  try {
    await db.query(
      `
      UPDATE grupo
      SET status = 'vendido'
      WHERE id_numeros_grupo = ?
      `,
      [id_grupo]
    );

    res.json({
      sucesso: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      erro: "Erro ao vender grupo",
    });
  }
});

module.exports = router;