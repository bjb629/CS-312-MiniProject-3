import express from "express";
import session from "express-session";
import "dotenv/config";
import pg from "pg";

const app = express();
const port = 3000;

const { Pool } = pg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "BlogDB",
  password: process.env.PG_PASSWORD,
  port: 5432
});

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "blog-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM blogs ORDER BY date_created DESC"
    );

    res.render("index.ejs", {
      posts: result.rows,
      editId: -1,
      user: req.session.user
    });
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.post("/signup", async (req, res) => {
  const userId = req.body.user_id;
  const password = req.body.password;
  const name = req.body.name;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length > 0) {
      return res.send(
        "User ID is already taken. Please choose another one."
      );
    }

    await pool.query(
      `INSERT INTO users (user_id, password, name)
       VALUES ($1, $2, $3)`,
      [userId, password, name]
    );

    res.redirect("/signin");
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.get("/signin", (req, res) => {
  res.render("signin.ejs");
});

app.post("/signin", async (req, res) => {
  const userId = req.body.user_id;
  const password = req.body.password;

  try {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE user_id = $1 AND password = $2`,
      [userId, password]
    );

    if (result.rows.length === 0) {
      return res.send("Incorrect user ID or password.");
    }

    req.session.user = result.rows[0];

    res.redirect("/");
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/submit", async (req, res) => {
  if (!req.session.user) {
    return res.send("You must sign in to create a post.");
  }

  const title = req.body.title;
  const content = req.body.content;

  try {
    await pool.query(
      `INSERT INTO blogs
       (creator_name, creator_user_id, title, body)
       VALUES ($1, $2, $3, $4)`,
      [
        req.session.user.name,
        req.session.user.user_id,
        title,
        content
      ]
    );

    res.redirect("/");
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.get("/edit/:id", async (req, res) => {
  if (!req.session.user) {
    return res.send("You must sign in to edit a post.");
  }

  const id = req.params.id;

  try {
    const result = await pool.query(
      "SELECT * FROM blogs WHERE blog_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.send("Post not found.");
    }

    const post = result.rows[0];

    if (post.creator_user_id !== req.session.user.user_id) {
      return res.send("You can only edit your own posts.");
    }

    const posts = await pool.query(
      "SELECT * FROM blogs ORDER BY date_created DESC"
    );

    res.render("index.ejs", {
      posts: posts.rows,
      editId: id,
      user: req.session.user
    });
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.post("/edit/:id", async (req, res) => {
  if (!req.session.user) {
    return res.send("You must sign in to edit a post.");
  }

  const id = req.params.id;
  const title = req.body.title;
  const content = req.body.content;

  try {
    const result = await pool.query(
      "SELECT * FROM blogs WHERE blog_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.send("Post not found.");
    }

    const post = result.rows[0];

    if (post.creator_user_id !== req.session.user.user_id) {
      return res.send("You can only edit your own posts.");
    }

    await pool.query(
      `UPDATE blogs
       SET title = $1, body = $2
       WHERE blog_id = $3`,
      [title, content, id]
    );

    res.redirect("/");
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.post("/delete/:id", async (req, res) => {
  if (!req.session.user) {
    return res.send("You must sign in to delete a post.");
  }

  const id = req.params.id;

  try {
    const result = await pool.query(
      "SELECT * FROM blogs WHERE blog_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.send("Post not found.");
    }

    const post = result.rows[0];

    if (post.creator_user_id !== req.session.user.user_id) {
      return res.send("You can only delete your own posts.");
    }

    await pool.query(
      "DELETE FROM blogs WHERE blog_id = $1",
      [id]
    );

    res.redirect("/");
  } catch (error) {
    console.log(error.message);
    res.send("Database error.");
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});