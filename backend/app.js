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
  host: "free-tier.gcp-us-central1.cockroachlabs.cloud",
  database: 'dark-walrus-177.defaultdb',
  port: 26257,
  ssl: {
    ca: fs.readFileSync('cc-ca.crt').toString()
  }
};

const pgClient = new pg.Client(pgConfig);
pgClient.connect();

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
      await pgClient.query(`select * from ${room};`);
      console.log(`${room} exists!`);
    } catch (e) {
      if (e?.routine === "NewUndefinedRelationError") {
        await pgClient.query(`create table ${room} (numPushed integer primary key, name text)`);
        console.log(`${room} created!`);
      }
    }

    console.log(`Joined Room ${room}`);
  })
})

io.on("connection", (socket) => {
  socket.on("buttonPress", (data) => {
    if (data.room) {
      const mostRecentButtomPress = responseArray[responseArray.length - 1];
      responseArray.push(data);
      socket.in(data.room).emit(data);

      if ((mostRecentButtomPress) && (data.room === mostRecentButtomPress.room) && (data.timestamp - mostRecentButtomPress.timestamp < 300)) {
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

const getApiAndEmit = (socket) => {
  const response = new Date();
  // Emitting a new message. Will be consumed by the client
  socket.emit("FromAPI", response);
};

server.listen(port, () => console.log(`Listening on port ${port}`));

export default app;
