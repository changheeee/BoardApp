// 필요한 모듈 및 패키지를 가져옵니다
const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const MongoStore = require("connect-mongo");
require("dotenv").config();

// const postRouter = require("./routes/wirte.js");

const mongoURL = process.env.DB_URL;

// Passport 미들웨어를 초기화합니다
app.use(passport.initialize());

// 세션 미들웨어를 설정합니다
app.use(
  session({
    resave: false,
    secret: "암호화에 쓸 비번",
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 },
    store: MongoStore.create({
      mongoUrl: mongoURL,
      dbName: "board",
    }),
  })
);

app.use(passport.session());

// MongoDB에 연결합니다
let db;
new MongoClient(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }) //몽고 드라이버
  .connect()
  .then((client) => {
    console.log("MongoDB 연결 성공");
    db = client.db("board");
    app.listen(8080, () => {
      console.log("http://localhost:8080 에서 서버 시작");
    });
  })
  .catch((err) => {
    console.log("MongoDB 연결 실패");
  });

// Passport 사용자 직렬화 및 역직렬화를 설정합니다
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username });
  });
});

passport.deserializeUser(async (user, done) => {
  let result = await db
    .collection("user")
    .findOne({ _id: new ObjectId(user.id) });
  delete result.password;
  process.nextTick(() => {
    return done(null, user);
  });
});

// Passport 로컬 전략을 설정합니다
passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "password",
    },
    async (id, password, cb) => {
      let result = await db.collection("user").findOne({ id: id });
      if (!result) {
        return cb(null, false, { message: "아이디가 DB에 없습니다." });
      }
      if (await bcrypt.compare(password, result.password)) {
        return cb(null, result);
      } else {
        return cb(null, false, { message: "비밀번호가 틀렸습니다." });
      }
    }
  )
);

// Passport 사용자 직렬화 및 역직렬화를 설정합니다
// passport.serializeUser((user, done) => {
//   done(null, user._id); // 변경: 사용자의 _id만 저장
// });

// passport.deserializeUser(async (id, done) => {
//   let result = await db.collection("user").findOne({ _id: new ObjectId(id) }); // 변경: _id로 조회
//   done(null, result); // 변경: 전체 사용자 객체 반환
// });

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// 정적 파일을 제공하는 미들웨어를 설정합니다
app.use(express.static(__dirname + "/public"));
app.use("/", showDate);
app.use("/list", showDate);

// 뷰 엔진을 EJS로 설정합니다
app.set("view engine", "ejs");

// JSON 요청을 파싱합니다
app.use(express.json());

// URL 인코딩된 요청을 파싱합니다
app.use(express.urlencoded({ extended: true }));

// 루트 경로를 처리합니다
app.get("/", (req, res) => {
  res.render(__dirname + "/index.ejs");
});

// 아이템 목록을 표시하는 라우트를 처리합니다
app.get("/list", async (req, res) => {
  let result = await db.collection("boardlist").find().toArray();
  res.render("board.ejs", { list: result });
});

app.get("/write", (req, res) => {
  if (!req.user) {
    // 클라이언트 사이드에서 alert를 띄우고 리디렉트하는 스크립트를 포함한 HTML 응답을 보냄
    res.send(`
      <script>
        alert("로그인이 필요합니다.");
        window.location.href = "/login";
      </script>
    `);
  } else {
    // 로그인한 사용자에게 글 작성 페이지 표시
    res.render("write.ejs");
  }
});

// 글 추가를 처리하는 라우트를 설정합니다
app.post("/add", async (req, res) => {
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

// 글 상세 페이지를 표시하는 라우트를 처리합니다
app.get("/detail/:id", async (req, res) => {
  const postId = req.params.id;
  await db
    .collection("boardlist")
    .updateOne({ _id: new ObjectId(postId) }, { $inc: { views: 1 } });
  let result = await db
    .collection("boardlist")
    .findOne({ _id: new ObjectId(postId) });
  res.render("detail.ejs", { detail: result });
});

// 글 수정 페이지를 표시하는 라우트를 처리합니다
app.get("/edit/:id", async (req, res) => {
  let result = await db
    .collection("boardlist")
    .findOne({ _id: new ObjectId(req.params.id) });
  res.render("edit.ejs", { edit: result });
});

// 글 업데이트를 처리하는 라우트를 설정합니다
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

// 글 삭제를 처리하는 라우트를 설정합니다
app.post("/delete/:id", async (req, res) => {
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

// 좋아요 기능을 처리하는 라우트를 설정합니다
app.get("/like/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    await db
      .collection("boardlist")
      .updateOne({ _id: new ObjectId(postId) }, { $inc: { like: 1 } });
    res.redirect(`/detail/${postId}`);
  } catch (e) {
    console.log(e);
    res.send("MongoDB 오류");
  }
});

// 로그인 페이지를 표시하는 라우트를 처리합니다
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// 로그인 처리를 위한 라우트를 설정합니다
app.post("/check_login", checkEmpty, (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    if (error) return res.status(500).json(error);
    if (!user) return res.status(401).json(info.message);

    req.logIn(user, (err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  })(req, res, next);
});

function checkEmpty(req, res, next) {
  const { id, password } = req.body;
  console.log(req.body);
  console.log(process.env.DB_URL);
  if (!id && !password) {
    res.send("아이디와 비밀번호 모두 입력하세요");
  } else if (!id) {
    res.send("아이디를 입력하세요");
  } else if (!password) {
    res.send("비밀번호를 입력하세요");
  } else {
    next();
  }
}

// 회원가입 페이지를 표시하는 라우트를 처리합니다
app.get("/join", (req, res) => {
  res.render("join.ejs");
});

// 회원가입 처리를 위한 라우트를 설정합니다
app.post("/join", async (req, res) => {
  let hash = await bcrypt.hash(req.body.password, 10);
  try {
    const { id, username, password, repassword } = req.body;

    if (password !== repassword) {
      return res.send("비밀번호가 일치하지 않습니다.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const existingUser = await db.collection("user").findOne({ id: id });
    if (existingUser) {
      res.send("이미 등록된 사용자입니다.");
    } else {
      const newUser = {
        id: id,
        username: username,
        password: hashedPassword,
      };

      await db.collection("user").insertOne(newUser);
      res.redirect("/login");
    }
  } catch (e) {
    console.log(e);
    res.send("MongoDB 오류");
  }
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.get("/mypage", (req, res) => {
  if (!req.user) {
    // 사용자가 로그인하지 않았다면 로그인 페이지로 리디렉션
    res.redirect("/login");
  } else {
    // 로그인한 사용자의 정보를 'mypage.ejs'에 전달
    res.render("mypage.ejs", { user: req.user });
  }
});

// 콘솔에 시간을 출력하는 미들웨어
function showDate(req, res, next) {
  console.log("현재시간:", new Date());

  next();
}

// 검색 페이지 라우트
app.get("/search", async (req, res) => {
  const query = req.query.query;
  try {
    let results = await db
      .collection("boardlist")
      .find({
        $or: [
          { title: { $regex: query, $options: "i" } },
          { content: { $regex: query, $options: "i" } },
        ],
      })
      .toArray();
    res.render("searchResult.ejs", { query: query, results: results });
  } catch (e) {
    console.log(e);
    res.send("MongoDB 오류");
  }
});

// app.use("/add", postRouter);
