const router = require("express").Router();
const { ObjectId } = require("mongodb");
// let connectDB = require("../database");

// let db;
// connectDB
//   .then((client) => {
//     console.log("MongoDB 연결 성공");
//     db = client.db("board");
//     app.listen(8080, () => {
//       console.log("http://localhost:8080 에서 서버 시작");
//     });
//   })
//   .catch((err) => {
//     console.log("MongoDB 연결 실패");
//   });

module.exports = (db) => {
  //글 작성 라우트
  router.post("/add", async (req, res) => {
    try {
      if (req.body.title == "") {
        res.send("제목을 입력하세요");
      } else {
        await db.collection("boardlist").insertOne({
          title: req.body.title,
          content: req.body.content,
          // 로그인 유저로 변경
          user_name: req.body.user_name,
          like: 0,
          views: 0,
          created_at: new Date(),
        });
        res.redirect("/list");
      }
    } catch (e) {
      console.log(e);
      res.send("MongoDB 오류");
    }
  });

  //글 상세페이지 표시
  router.get("/detail/:id", async (req, res) => {
    const postId = req.params.id;
    await db
      .collection("boardlist")
      .updateOne({ _id: new ObjectId(postId) }, { $inc: { views: 1 } });
    let result = await db
      .collection("boardlist")
      .findOne({ _id: new ObjectId(postId) });
    res.render("detail.ejs", { detail: result });
  });

  //글 수정페이지 표시
  router.get("/edit/:id", async (req, res) => {
    let result = await db
      .collection("boardlist")
      .findOne({ _id: new ObjectId(req.params.id) });
    res.render("edit.ejs", { edit: result });
  });

  //글 업데이트
  router.post("/update/:id", async (req, res) => {
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
            $currentDate: { created_at: true },
          }
        );
        res.redirect(`/detail/${postId}`);
      }
    } catch (e) {
      console.log(e);
      res.send("MongoDB 오류");
    }
  });

  //글 삭제
  router.post("/delete/:id", async (req, res) => {
    try {
      await db
        .collection("boardlist")
        .deleteOne({ _id: new ObjectId(req.params.id) });
      res.redirect("/list");
    } catch (e) {
      console.log(e);
      res.send("MongoDB 오류");
    }
  });

  //좋아요
  router.get("/like/:id", async (req, res) => {
    const postId = req.params.id;

    try {
      await db
        .collection("boardlist")
        .updateOne({ _id: new ObjectId(postId) }, { $inc: { like: 1 } });
      res.redirect(`/detail/${postId}`);
    } catch (e) {
      console.log(e);
      res.send("mongoDB 오류");
    }
  });

  return router;
};
