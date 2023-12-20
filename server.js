// 필요한 모듈 및 패키지를 가져옵니다
const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
// const { mongoURI } = require("./Config/dev.js"); // 설정 파일에서 MongoDB URI를 가져옵니다
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const MongoStore = require("connect-mongo");

require("dotenv").config();

const mongoURL = process.env.DB_URL;

// Passport 미들웨어를 초기화합니다
app.use(passport.initialize());

// 세션 미들웨어를 설정합니다
app.use(
  session({
    resave: false,
    secret: "암호화에 쓸 비번", // 세션 암호화에 사용할 비밀 키
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, //쿠키 저장 기간
    store: MongoStore.create({
      mongoUrl: mongoURL,
      dbName: "board",
    }),
  })
);

app.use(passport.session());

// 인증을 위해 Local 전략을 사용하도록 Passport를 설정합니다
passport.use(
  new LocalStrategy(async (username, password, cb) => {
    try {
      let result = await db.collection("user").findOne({ username: username });
      if (!result) {
        return cb(null, false, { message: "아이디가 DB에 없습니다." });
      }
      if (await bcrypt.compare(password, result.password)) {
        return cb(null, result);
      } else {
        return cb(null, false, { message: "비밀번호가 틀렸습니다." });
      }
    } catch (error) {
      console.error("bcrypt 비교 오류:", error);
      return cb(error);
    }
  })
);

// 사용자를 세션 관리를 위해 직렬화 및 역직렬화합니다
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

// MongoDB에 연결합니다
let db;

new MongoClient(mongoURL)
  .connect()
  .then((client) => {
    console.log("mongoDB");
    db = client.db("board");
    // 서버를 8080 포트에서 시작합니다
    app.listen(8080, (req, res) => {
      console.log("http://localhost:8080 에서 서버시작");
    });
  })
  .catch((err) => {
    console.log("Connect Failed");
  });

// 정적 파일을 제공하는 미들웨어를 설정합니다
app.use(express.static(__dirname + "/public"));
app.use("/", showDate);
app.use("/list", showDate);
// app.use("/check_login", checkLogin);

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
  res.render("board.ejs", { list: result }); // EJS 렌더링
  // console.log(new Date());
});

// 글 작성 페이지를 표시하는 라우트를 처리합니다
app.get("/write", async (req, res) => {
  res.render("write.ejs"); // EJS 렌더링
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
        user_name: req.body.user_name,
        like: 0,
        views: 0,
        created_at: new Date(),
      });
      res.redirect("/list");
    }
  } catch (e) {
    console.log(e);
    res.send("mongoDB 오류");
  }
});

// 글 상세 페이지를 표시하는 라우트를 처리합니다
app.get("/detail/:id", async (req, res) => {
  // URL에서 ID를 가져옵니다
  const postId = req.params.id;

  // 조회수를 1 증가시킵니다
  await db
    .collection("boardlist")
    .updateOne({ _id: new ObjectId(postId) }, { $inc: { views: 1 } });

  // 게시물을 조회합니다
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
          $currentDate: { created_at: true }, // created_at 필드를 현재 시간으로 설정
        }
      );
      res.redirect(`/detail/${postId}`);
    }
  } catch (e) {
    console.log(e);
    res.send("mongoDB 오류");
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
    res.send("mongoDB 오류");
  }
});

// 좋아요 기능을 처리하는 라우트를 설정합니다
app.get("/like/:id", async (req, res) => {
  // URL에서 ID를 가져옵니다
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

// 로그인 페이지를 표시하는 라우트를 처리합니다
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// 로그인 처리를 위한 라우트를 설정합니다
app.post(
  "/check_login",
  checkEmpty,
  async (req, res, next) => {
    console.log("body: ", req.body);
    passport.authenticate("local", (error, user, info) => {
      if (error) return res.status(500).json(error);
      if (!user) return res.status(401).json(info.message);

      req.logIn(user, (err) => {
        if (err) return next(err);
        res.redirect("/");
      });
    })(req, res, next);
  }
  // }
);

function checkEmpty(req, res, next) {
  const { id, password } = req.body;

  if (!id && !password) {
    return res.send("아이디와 비밀번호 모두 입력하세요");
  } else if (!id) {
    return res.send("아이디를 입력하세요");
  } else if (!password) {
    return res.send("비밀번호를 입력하세요");
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
    const { id, username, password } = req.body;

    // 이미 등록된 사용자인지 확인합니다
    const existingUser = await db.collection("user").findOne({ id: id });

    if (existingUser) {
      res.send("이미 등록된 사용자입니다.");
    } else {
      // 새로운 사용자를 생성하여 MongoDB에 저장합니다
      const newUser = {
        id: id,
        username: username,
        password: password,
      };

      await db.collection("user").insertOne(newUser);
      res.redirect("/login"); // 회원가입 성공 시 로그인 페이지로 이동
    }
  } catch (e) {
    console.log(e);
    res.send("mongoDB 오류");
  }
});

passport.use(
  new LocalStrategy(async (입력아이디, 입력비번, cb) => {
    let result = await db.collection("user").findOne({ username: 입력아이디 });
    if (!result) {
      return cb(null, false, { message: "아이디 db에 없습니다." });
    }
    if (await bcrypt.compare(입력비번, result.password)) {
      return cb(null, result);
    } else {
      return cb(null, false, { message: "비번 틀렸습니다." });
    }
  })
);

//콘솔에 시간
function showDate(req, res, next) {
  console.log("현재시간:", new Date());
  next();
}

// function checkLogin(req, res, next) {
//  const { id, password } = req.body;
// if (!id && !password) {
//   return res.send("아이디와 비밀번호 모두 입력하세요");
// } else if (!id) {
//   return res.send("아이디를 입력하세요");
// } else if (!password) {
//   return res.send("비밀번호를 입력하세요");
// } else {
//   next()
// }
// }

// app.get("/check_login", (req, res) => {});
