import { table } from "console";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import createError from "http-errors";
import path from "path";
import pg from "pg";
import { Server as socketIo } from "socket.io";

import indexRouter from "./routes/index.js";
import usersRouter from "./routes/users.js";

dotenv.config();
const __dirname = path.resolve();

// Configure Express server and Socket IO
const app = express();
const port = process.env.PORT || 8000;
const server = http.createServer(app);

const io = new socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Configure CockroachDB database
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
    console.log("Enable changefeeds in CockroachDB");
    try {
        await pgClient.query("SET CLUSTER SETTING kv.rangefeed.enabled = true;");
        console.log("Setting flag succeeded!");
    } catch (e) {
        console.error("Unable to enable changefeeds in CockroachDB: ", e);
    }
}

init();

const timeElapsedBetweenButtonPresses = 300;
// const roomCountMap = {};
// const roomDataMap = {};

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

        const tableName = `game${room}`;

        try {
            // Check to see if there is a table with this room code
            const response = await pgClient.query(`select count(*) from ${tableName};`);
            const existingCount = response?.rows[0].count;

            console.log(`${tableName} exists! Count is ${existingCount}`);
            io.sockets.in(room).emit("count", existingCount);
        } catch (e) {
            if (e?.routine === "NewUndefinedRelationError") {
                try {
                    // A table for this room code doesn't exist, create a table for that room code
                    await pgClient.query(`create table ${tableName} (numpushed integer primary key, uid text, timestamp bigint);`);
                    await pgClient.query(`create index timestamps on ${tableName} (timestamp);`);
                    io.sockets.in(room).emit("count", 0);
                    console.log(`${tableName} created!`);
                } catch (e) {
                    console.log("An error occurred while creating the room: ", e);
                }
            } else {
                console.error("An error occurred while retrieving the table: ", e);
            }
        }

        startListener(room);
    });
});

io.on("connection", (socket) => {
    socket.on("buttonPress", async (data) => {
        if (data.room) {
            const tableName = `game${data.room}`;

            try {
                const response = await pgClient.query(`insert into ${tableName} select ${data.count}, '${data.id}', ${data.timestamp} where not exists ` + 
                        `(select * from ${tableName} where timestamp >= ${data.timestamp - timeElapsedBetweenButtonPresses} or ` + 
                        `uid in (select uid from ${tableName} order by timestamp desc limit 1));`);

                if (response.rowCount === 0) {
                    // The row was not inserted because the timestamp was too close to the previous timestamp OR because you were the last person to push the button
                    console.log("ooh too fast there");
                    await truncateTable(data.room);
                } else {
                    console.log("inserted!");
                }
            } catch(e) {
                if (e?.routine === "NewUniquenessConstraintViolationError") {
                    console.log("you dun goofed");
                    await truncateTable(data.room);
                } else {
                    console.log("An error occurred when inserting a new row to the database: ", e);
                }
            }
        } else {
            console.error("No room code was provided");
        }
    });
});

const truncateTable = async (room) => {
    try {
        await pgClient.query(`truncate game${room};`);
    } catch (e) {
        console.error(e);
    }
}

const startListener = async (room) => {
    const tableName = `game${room}`;

    // Create a new client
    const listenerClient = new pg.Client(pgConfig);
    listenerClient.connect();

    await listenerClient.query("SET CLUSTER SETTING kv.rangefeed.enabled = true;");

    const dbTimestamp = await listenerClient.query("select cluster_logical_timestamp() as now;");
    const now = dbTimestamp.rows[0].now;

    let buttonListener = listenerClient.query(new pg.Query(`create changefeed for table ${tableName} with cursor='${now}'`));
    buttonListener.on("row", async (row) => {
        // Someone inserted something into the database, i.e. someone pushed the button
        // We now know what the last button pressed was, now emit an event to all the players saying the new button is that value
        // socket.emit(count, ...);
        // output = JSON.parse(row.value).after;

        const response = await pgClient.query(`select count(*) from ${tableName}`);
        io.sockets.in(room).emit("count", response.rows[0].count);
    });

    buttonListener.on("error", (err) => {
        if (err.routine === "shouldFilter") {
            // The table was truncated, reset the count
            io.sockets.in(room).emit("count", 0);
            startListener(room);
        } else {
            // We might have an actual error
            console.error("An error occurred in the changefeed: ", err);
        }
    });

    console.log(`Created changefeed for room ${room}!`);
};

const getApiAndEmit = (socket) => {
    const response = new Date();
    // Emitting a new message. Will be consumed by the client
    socket.emit("FromAPI", response);
};

server.listen(port, () => console.log(`Listening on port ${port}`));

export default app;
