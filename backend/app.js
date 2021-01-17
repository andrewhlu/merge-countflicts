var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var fs = require("fs");
var dotenv = require("dotenv");
var moment = require("moment");

var pg = require("pg");

const http = require("http");
const socketIo = require("socket.io");

var cors = require("cors");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

dotenv.config();

const pgConfig = {
  user: "cabbage",
  password: process.env.CRDB_PWD,
  host: "little-mule-8bv.gcp-us-west2.cockroachlabs.cloud",
  database: 'defaultdb',
  port: 26257,
  ssl: {
    ca: fs.readFileSync('little-mule-ca.crt').toString()
  }
};



const pgClient = new pg.Client(pgConfig);
pgClient.connect();

async function init() {
  console.log("Setting flag");
  await pgClient.query("SET CLUSTER SETTING kv.rangefeed.enabled = true;");
  console.log("Setting flag succeeded!");
}

init();


const responseArray = [];

const port = process.env.PORT || 3001;

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cors());
// app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const timeElapsedBetweenButtonPresses = 300;
// const roomCountMap = {};
// const roomDataMap = {};

let interval;

// var count = 0;

io.on("connection", (socket) => {
  console.log("New client connected");
  if (interval) {
    clearInterval(interval);
  }
  interval = (() => getApiAndEmit(socket), 1000);
  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });
});

io.on("connection", (socket) => {
  socket.on("room", async (room) => {
    socket.join(room);
    let existingCount;
    let tableName = `game${room}`;
    try {
      await pgClient.query(`select * from ${tableName};`);
      console.log(`${tableName} exists!`);

      try {
        existingCount = (await pgClient.query(`select count(*) from ${tableName};`)).rows[0].count;
        console.log(existingCount);
        io.sockets.in(room).emit("count", existingCount);
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      // console.log("In here");
      // console.log(e);
      if (e?.routine === "NewUndefinedRelationError") {
        // await pgClient.query(`create table ${room} (numPushed integer primary key, name text)`);
        try {
          await pgClient.query(
            `create table ${tableName} (numpushed integer primary key, "uid" text, "timestamp" bigint);`
          );
          io.sockets.in(room).emit("count", 0);
        } catch (e) {
          // console.log("Here Noe");
          console.log(e);
        }
        console.log(`${tableName} created!`);
      }
    }
    // startListener(room);
    console.log(`Joined ${tableName}`);
  });
});

io.on("connection", (socket) => {
  socket.on("buttonPress", async (data) => {
    let mostRecentButtomPress;
    let count;

    if (data.room) {
      let tableName = `game${data.room}`;

      // Get most recent click
      try {
        mostRecentButtomPress = (await pgClient.query(
          `select * from ${tableName} order by timestamp desc limit 1;`
        )).rows;
        console.log(
          `Retrieved most recently pressed button from ${tableName} table`
        );
        console.log(mostRecentButtomPress);
        console.log(mostRecentButtomPress.length);
      } catch (e) {
        console.error(e);
      }

      // Insert new click into db
      try {
        await pgClient.query(`insert into ${tableName} values ($1, $2, $3);`, [
          data.count,
          data.id,
          data.timestamp,
        ]);
        console.log(`Added Button Object to ${tableName} table`);
      } catch (e) {
        // Users prolly messed up, delete all contents of table
        if (e?.routine === "NewUniquenessConstraintViolationError") {
          try {
            await pgClient.query(`truncate ${tableName};`);
            count = 0;
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Get new count
      try {
        count = (await pgClient.query(`select count(*) from ${tableName};`)).rows[0].count;
        console.log(`Retrieved count of ${tableName} table`);
      } catch (e) {
        console.error(e);
      }

      if (
        (mostRecentButtomPress.length !== 0 &&
          // data.room === mostRecentButtomPress.room &&
          data.timestamp - mostRecentButtomPress[0].timestamp <
            timeElapsedBetweenButtonPresses) ||
        (mostRecentButtomPress.length !== 0 &&
          data.id === mostRecentButtomPress[0].uid)
      ) {
        // If Users messed up, delete all contents of table
        try {
          await pgClient.query(`truncate ${tableName};`);
          count = 0;
        } catch (e) {
          console.error(e);
        }
      } else {
        ;
        // If they didn't mess up, emit count
      }
      io.sockets.in(data.room).emit("count", count);

    }
  });
});

async function startListener(room) {
  const dbTimestamp = await pgClient.query("select cluster_logical_timestamp() as now;");
  const now = dbTimestamp.rows[0].now;
  console.log(now);
  console.log(`create changefeed for table game${room} with cursor='${now}'`);

  const buttonListener = pgClient.query(new pg.Query(`create changefeed for table game${room} with cursor='${now}'`));
  buttonListener.on("row", (row) => {
    // Someone inserted something into the database, i.e. someone pushed the button
    // We now know what the last button pressed was, now emit an event to all the players saying the new button is that value
    // socket.emit(count, ...);
    output = JSON.parse(row.value).after;
    console.log(output)
    io.sockets.in(room).emit("count", output);
  })
}

const getApiAndEmit = (socket) => {
  const response = new Date();
  // Emitting a new message. Will be consumed by the client
  socket.emit("FromAPI", response);
};

server.listen(port, () => console.log(`Listening on port ${port}`));

module.exports = app;
// export default app;
