// const exp = require('constants');
const { error } = require("console");
const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
const { mongoURI } = require("./Config/dev.js");

let db;

new MongoClient(mongoURI)
  .connect()
  .then((client) => {
    console.log("mongoDB");
    db = client.db("board");
    app.listen(8080, (req, res) => {
      console.log("http://localhost:8080 에서 서버시작");
    });
  })
  .catch((err) => {
    console.log("Connect Failed");
  });

// app.listen(8080, (req, res) => {
//     console.log('http://localhost:8080 에서 서버 시작');
// });

app.use(express.static(__dirname + "/public"));

app.set("view engine", "ejs");

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render(__dirname + "/index.ejs");
});

app.get("/list", async (req, res) => {
  let result = await db.collection("boardlist").find().toArray();
  res.render("board.ejs", { list: result }); //ejs
});

app.get("/write", async (req, res) => {
  res.render("write.ejs"); //ejs
});

app.post("/add", async (req, res) => {
  try {
    if (req.body.title == "") {
      res.send("제목을 입력하세요");
    } else {
      await db.collection("boardlist").insertOne({
        title: req.body.title,
        content: req.body.content,
        user_name: req.body.user_name,
        like: 0,
        views: 0,
        created_at: new Date(),
      });
      res.redirect("/list");
    }
  } catch (e) {
    console.log(e);
    res.send("mongoDB Error");
  }
});

app.get("/detail/:id", async (req, res) => {
  // URL에서 ID 가져오기
  const postId = req.params.id;

  // 조회수를 1 증가시킵니다.
  await db
    .collection("boardlist")
    .updateOne({ _id: new ObjectId(postId) }, { $inc: { views: 1 } });

  // 게시물 조회
  let result = await db
    .collection("boardlist")
    .findOne({ _id: new ObjectId(postId) });

  res.render("detail.ejs", { detail: result });
});

app.get("/edit/:id", async (req, res) => {
  let result = await db
    .collection("boardlist")
    .findOne({ _id: new ObjectId(req.params.id) });

  res.render("edit.ejs", { edit: result });
});

app.post("/update/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    if (req.body.title == "") {
      res.send("제목을 입력하세요");
    } else {
      await db.collection("boardlist").updateOne(
        { _id: new ObjectId(postId) },
        {
          $set: {
            title: req.body.title,
            content: req.body.content,
            user_name: req.body.user_name,
          },
          $currentDate: { created_at: true }, // created_at 필드를 현재 시간으로 설정
        }
      );
      res.redirect(`/detail/${postId}`);
    }
  } catch (e) {
    console.log(e);
    res.send("mongoDB Error");
  }
});

app.post("/delete/:id", async (req, res) => {
  try {
    await db
      .collection("boardlist")
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect("/list");
  } catch (e) {
    console.log(e);
    res.send("mongoDB Error");
  }
});

//좋아요

app.get("/like/:id", async (req, res) => {
  // URL에서 ID 가져오기
  const postId = req.params.id;
  try {
    await db
      .collection("boardlist")
      .updateOne({ _id: new ObjectId(postId) }, { $inc: { like: 1 } });
    res.redirect(`/detail/${postId}`);
  } catch (e) {
    console.log(e);
    res.send("mongoDB Error");
  }
});
