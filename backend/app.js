import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import createError from "http-errors";
import fs from "fs";
import path from "path";
import pg from "pg";
import { Server as socketIo } from "socket.io";

import indexRouter from "./routes/index.js";
import usersRouter from "./routes/users.js";

dotenv.config();
const __dirname = path.resolve();

const app = express();
const port = process.env.PORT || 8000;

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

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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

const io = new socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let interval;

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

    try {
      await pgClient.query(`select * from game${room};`);
      console.log(`${room} exists!`);
    } catch (e) {
      if (e?.routine === "NewUndefinedRelationError") {
        await pgClient.query(`create table game${room} (numPushed integer primary key, name text)`);
        console.log(`${room} created!`);
      }
    }

    startListener(room);

    console.log(`Joined Room ${room}`);
  })
})

io.on("connection", (socket) => {
  socket.on("buttonPress", (data) => {
    if (data.room) {
      const mostRecentButtonPress = responseArray[responseArray.length - 1];
      responseArray.push(data);
      socket.in(data.room).emit(data);

      if ((mostRecentButtonPress) && (data.room === mostRecentButtonPress.room) && (data.timestamp - mostRecentButtonPress.timestamp < 300)) {
        // socket.in(data.room).emit("reset", true);
        socket.emit("reset", true);
        console.log("You done messed up!");
      } else {
        socket.emit("reset", false);
      }
      console.log(data);
    }
  })
})

async function startListener(room) {
  const dbTimestamp = await pgClient.query("select cluster_logical_timestamp() as now;");
  const now = dbTimestamp.rows[0].now;
  console.log(now);
  console.log(`create changefeed for table game${room} with cursor='${now}'`);

  const buttonListener = pgClient.query(new pg.Query(`create changefeed for table game${room} with cursor='${now}'`));
  buttonListener.on("row", (row) => {
    console.log(JSON.parse(row.value).after);
  })
}

const getApiAndEmit = (socket) => {
  const response = new Date();
  // Emitting a new message. Will be consumed by the client
  socket.emit("FromAPI", response);
};

server.listen(port, () => console.log(`Listening on port ${port}`));

export default app;
