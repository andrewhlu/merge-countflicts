var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const http = require("http");
const socketIo = require("socket.io");

var cors = require("cors");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

const responseArray = [];

const port = process.env.PORT || 3001;

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
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
  socket.on("room", (room) => {
    socket.join(room);
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

module.exports = app;
