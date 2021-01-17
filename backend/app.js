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
        await pgClient.query("set cluster setting kv.rangefeed.enabled = true;");
        console.log("Setting flag succeeded!");
    } catch (e) {
        console.error("Unable to enable changefeeds in CockroachDB: ", e);
    }
}

init();

const timeElapsedBetweenButtonPresses = 1000;
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
    socket.on("room", async (data) => {
        const room = data.room;
        const username = data.username;
        const uid = data.id;

        console.log(`${username} (uid ${uid}) joined room ${room}`);

        socket.join(room);

        const gameTableName = `game${room}`;
        const usersTableName = `users${room}`;

        try {
            // Check to see if there is a table with this room code
            const gameTable = await pgClient.query(`select * from ${gameTableName};`);
            const existingCount = gameTable?.rowCount;
            const lastUid = existingCount > 0 ? gameTable?.rows.filter(r => parseInt(r.numpushed) === existingCount)[0]?.uid : undefined;

            console.log(`${gameTableName} exists! Count is ${existingCount} and lastUid is ${lastUid}`);
            io.sockets.in(room).emit("count", {
                count: existingCount,
                lastUid: lastUid
            });
        } catch (e) {
            if (e?.routine === "NewUndefinedRelationError") {
                try {
                    // A table for this room code doesn't exist, create a table for that room code
                    await pgClient.query(`create table ${gameTableName} (numpushed integer primary key, uid text, timestamp bigint);`);
                    await pgClient.query(`create table ${usersTableName} (uid text primary key, name text);`);
                    await pgClient.query(`create index timestamps on ${gameTableName} (timestamp);`);
                    io.sockets.in(room).emit("count", {
                        count: 0,
                        lastUid: null
                    });
                    console.log(`${gameTableName} created!`);
                } catch (e) {
                    console.log("An error occurred while creating the game: ", e);
                }
            } else {
                console.error("An error occurred while retrieving the table: ", e);
            }
        }

        try {
            await pgClient.query(`insert into ${usersTableName} values ('${uid}', '${username}');`);
            const usersTable = await pgClient.query(`select * from ${usersTableName};`);

            io.sockets.in(room).emit("users", usersTable.rows);
        } catch (e) {
            console.log("An error occurred while retrieving the users table: ", e);
        }

        startGameListener(room);
        startUsersListener(room);
    });
});

io.on("connection", (socket) => {
    socket.on("buttonPress", async (data) => {
        if (data.room) {
            const tableName = `game${data.room}`;

            try {
                const response = await pgClient.query(`insert into ${tableName} select ${data.count}, '${data.id}', ${data.timestamp} where not exists ` + 
                        `(select 1 from ${tableName} where timestamp >= ${data.timestamp - timeElapsedBetweenButtonPresses} or ` + 
                        `(select uid = '${data.id}' from ${tableName} order by timestamp desc limit 1));`);

                if (response.rowCount === 0) {
                    // The row was not inserted because the timestamp was too close to the previous timestamp 
                    // OR because you were the last person to push the button
                    console.log("ooh too fast there");
                    await endGame(data.room, data.id, 0);
                } else {
                    console.log("inserted!");
                }
            } catch(e) {
                if (e?.routine === "NewUniquenessConstraintViolationError") {
                    console.log("you dun goofed");
                    await endGame(data.room, data.id, 1);
                } else {
                    console.log("An error occurred when inserting a new row to the database: ", e);
                }
            }
        } else {
            console.error("No room code was provided");
        }
    });
});

const endGame = async (room, id, reason) => {
    const gameTableName = `game${room}`;
    const usersTableName = `users${room}`;

    const game = await pgClient.query(`select * from ${gameTableName};`);

    try {
        await pgClient.query(`truncate game${room};`);
    } catch (e) {
        console.error(e);
    }
}

let currentGameListeners = [];
let currentUsersListeners = [];

const startGameListener = async (room) => {
    if (!currentGameListeners.includes(room)) {
        currentGameListeners.push(room);

        const tableName = `game${room}`;

        // Create a new client
        const listenerClient = new pg.Client(pgConfig);
        listenerClient.connect();

        await listenerClient.query("set cluster setting kv.rangefeed.enabled = true;");

        const dbTimestamp = await listenerClient.query("select cluster_logical_timestamp() as now;");
        const now = dbTimestamp.rows[0].now;

        const buttonListener = listenerClient.query(new pg.Query(`create changefeed for table ${tableName} with cursor='${now}'`));
        buttonListener.on("row", async (row) => {
            const response = await pgClient.query(`select count(*) from ${tableName}`);
            io.sockets.in(room).emit("count", {
                count: parseInt(response.rows[0].count),
                lastUid: JSON.parse(row.value).after.uid
            });
        });

        buttonListener.on("error", (err) => {
            currentGameListeners.splice(currentGameListeners.indexOf(room), 1);
            if (err.routine === "shouldFilter") {
                // The table was truncated, reset the count
                io.sockets.in(room).emit("count", {
                    count: 0,
                    lastUid: undefined
                });
                startGameListener(room);
            } else {
                // We might have an actual error
                console.error("An error occurred in the changefeed: ", err);
            }
        });

        console.log(`Created game changefeed for room ${room}!`);
    } else {
        console.log(`Game changefeed should already exist for room ${room}`);
    }
};

const startUsersListener = async (room) => {
    if (!currentUsersListeners.includes(room)) {
        currentUsersListeners.push(room);

        const tableName = `users${room}`;

        // Create a new client
        const listenerClient = new pg.Client(pgConfig);
        listenerClient.connect();

        await listenerClient.query("set cluster setting kv.rangefeed.enabled = true;");

        const dbTimestamp = await listenerClient.query("select cluster_logical_timestamp() as now;");
        const now = dbTimestamp.rows[0].now;

        const buttonListener = listenerClient.query(new pg.Query(`create changefeed for table ${tableName} with cursor='${now}'`));
        buttonListener.on("row", async (row) => {
            console.log(JSON.parse(row.value).after);
            io.sockets.in(room).emit("users", [JSON.parse(row.value).after]);
        });

        buttonListener.on("error", (err) => {
            console.error("An error occurred in the changefeed: ", err);
            currentUsersListeners.splice(currentUsersListeners.indexOf(room), 1);
        });

        console.log(`Created users changefeed for room ${room}!`);
    } else {
        console.log(`Users changefeed should already exist for room ${room}`);
    }
};

const getApiAndEmit = (socket) => {
    const response = new Date();
    // Emitting a new message. Will be consumed by the client
    socket.emit("FromAPI", response);
};

server.listen(port, () => console.log(`Listening on port ${port}`));

export default app;
