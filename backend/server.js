const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./database.db");

// =======================
// TABELAS
// =======================


db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    senha TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    cor TEXT,
    user_id INTEGER
  )
`);

db.run(`
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT,
    descricao TEXT,
    prazo TEXT,
    prioridade TEXT,
    concluida INTEGER,
    concluida_em TEXT,
    user_id INTEGER,
    categoria_id INTEGER
)
`);

// =======================
// AUTH
// =======================

app.post("/register", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({
      erro: "Preencha todos os campos"
    });
  }

  if (senha.length < 4) {
    return res.status(400).json({
      erro: "Senha muito curta"
    });
  }

  try {

    const hash = await bcrypt.hash(senha, 10);

    db.run(
      "INSERT INTO users (email, senha) VALUES (?, ?)",
      [email, hash],
      function (err) {

        if (err) {
          return res.status(400).json({
            erro: "Usuário já existe"
          });
        }

        res.json({ ok: true });
      }
    );

  } catch {
    res.status(500).json({
      erro: "Erro interno"
    });
  }
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {

      if (err) {
        return res.status(500).json({
          erro: err.message
        });
      }

      if (!user) {
        return res.status(401).json({
          erro: "Login inválido"
        });
      }

      const senhaCorreta = await bcrypt.compare(
        senha,
        user.senha
      );

      if (!senhaCorreta) {
        return res.status(401).json({
          erro: "Login inválido"
        });
      }

      const token = Math.random().toString(36);

      res.json({
        userId: user.id,
        token
      });
    }
  );
});

// =======================
// CATEGORIAS
// =======================

app.post("/categorias", (req, res) => {
  const { nome, cor, userId } = req.body;

  if (!nome || !userId) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }

  db.run(
    "INSERT INTO categorias (nome, cor, user_id) VALUES (?, ?, ?)",
    [nome, cor || "#ffffff", userId],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });

      res.json({ id: this.lastID, nome, cor });
    }
  );
});

app.get("/categorias/:userId", (req, res) => {
  db.all(
    "SELECT * FROM categorias WHERE user_id = ?",
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json(rows);
    }
  );
});

// =======================
// TASKS
// =======================

// 🔥 FILTRO POR CATEGORIA
app.get("/tasks/:userId/:categoriaId", (req, res) => {
  const { userId, categoriaId } = req.params;

  db.all(
    "SELECT * FROM tasks WHERE user_id = ? AND categoria_id = ?",
    [userId, categoriaId],
    (err, rows) => {
      if (err) {
        console.error("ERRO:", err);
        return res.status(500).json({ erro: err.message });
      }

      res.json(rows);
    }
  );
});

// 🔥 LISTAR TODAS (SEM JOIN — ESTÁVEL)
app.get("/tasks/:userId", (req, res) => {
  db.all(
    "SELECT * FROM tasks WHERE user_id = ?",
    [req.params.userId],
    (err, rows) => {
      if (err) {
        console.error("ERRO:", err);
        return res.status(500).json({ erro: err.message });
      }

      res.json(rows);
    }
  );
});

// 🔥 CRIAR TASK
app.post("/tasks", (req, res) => {
  const {
  titulo,
  descricao,
  prazo,
  prioridade,
  userId,
  categoriaId
} = req.body;

  console.log("CRIANDO:", req.body);

  if (!titulo || !userId) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }

  db.run(
    `
    INSERT INTO tasks (
    titulo,
    descricao,
    prazo,
    prioridade,
    concluida,
    user_id,
    categoria_id
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      titulo,
      descricao || "",
      prazo || null,
      prioridade || "Baixa",
      0,
      userId,
      categoriaId || null
    ],
    function (err) {
      if (err) {
        console.error("ERRO INSERT:", err);
        return res.status(500).json({ erro: err.message });
      }

      res.json({ id: this.lastID });
    }
  );
});

// CONCLUIR
app.put("/tasks/:id", (req, res) => {
  db.run(
    `
    UPDATE tasks
    SET
      concluida = 1,
      concluida_em = DATE('now')
    WHERE id = ?
    `,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ ok: true });
    }
  );
});

// DELETAR
app.delete("/tasks/:id/:userId", (req, res) => {

  const { id, userId } = req.params;

  db.run(

    "DELETE FROM tasks WHERE id = ? AND user_id = ?",

    [id, userId],

    function(err) {

      if (err) {
        console.log(err);
        return res.status(500).send("Erro ao deletar");
      }

      res.json({
        ok: true
      });
    }
  );
});

// =======================
// START
// =======================

app.listen(3000, () => {
  console.log("Servidor rodando 🚀");
});
