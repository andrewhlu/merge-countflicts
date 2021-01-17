import React, { Component } from "react";
import {
  Checkbox,
  FormGroup,
  FormControlLabel,
  TextField,
  Button,
  Typography,
} from "@material-ui/core";

import { CountdownCircleTimer } from "react-countdown-circle-timer";
import socketIOClient from "socket.io-client";

const ENDPOINT = "http://localhost:8000";

function uuidv4() {
  return "xxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateUniqueNumber() {
  return "xxxxxxxxxxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class Main extends Component {
  constructor(props) {
    super(props);
    this.state = {
      username: "",
      room: "",
      count: 0,
      loadClient: true,
      createRoomChecked: false,
      joinRoomChecked: false,
      roomIdGenerated: false,
      startGame: false,
      response: "",
      socketIO: null,
      id: null,
      highestScore: -1,
      timerDuration: 60,
      timerKey: 0,
      isPressMeButtonDisabled: false,
      users: [],
      lastEvent: {}
    };
  }

  componentDidMount() {
    this.setState({ id: generateUniqueNumber() }, () => {
      this.setState(
        { socketIO: socketIOClient(ENDPOINT, { transport: ["websocket"] }) },
        () => {
          this.state.socketIO.on("count", (data) => {
            console.log(data);
            this.setState({ count: data.count, lastEvent: data });
          });

          this.state.socketIO.on("users", (data) => {
            console.log(data);

            data.forEach((user) => {
              if (this.state.users.filter(u => u.uid === user.uid).length === 0) {
                // console.log(`Adding ${user.uid}`);
                this.setState({ users: [...this.state.users, user] });
              }
            });
          });
        }
      );
    });

    return () => this.socketIO.disconnect();
  }

  componentDidUpdate(prevState) {
    if (prevState.count !== this.state.count) {
      if (this.state.count > this.state.highestScore) {
        this.setState({ highestScore: this.state.count });
      }
    }
  }

  joinRoom = () => {
    const { username, room, id, socketIO } = this.state;
    socketIO.emit("room", {
      room: room,
      username: username,
      id: id
    });
    this.setState({ startGame: true });
  };

  handleButtonPress = () => {
    const { id, count, room, socketIO } = this.state;

    const data = {
      id: id,
      room: room,
      count: parseInt(count) + 1,
      timestamp: Date.now(),
    };
    console.log(data);
    socketIO.emit("buttonPress", data);
  };

  // generateLastMoveString = () => {
  //   const { users, lastEvent } = this.state;
  //   const lastUser = ;
  //   return `${users.filter(u => u.uid === lastEvent.lastUid)[0]} increased the count to ${lastEvent.count}!`;
  // };

  render() {
    const {
      username,
      room,
      count,
      createRoomChecked,
      joinRoomChecked,
      roomIdGenerated,
      startGame,
      highestScore,
      users,
      lastEvent
    } = this.state;
    return (
      <div>
        {!startGame ? (
          <>
            <TextField
              id="usernameField"
              value={username}
              autoFocus={true}
              placeholder="Username"
              // helperText={<Typography id="helpText">Enter Room ID Here...</Typography>}
              onChange={(event) => {
                this.setState({username: event.target.value});
              }}
            />
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    id="checkbox"
                    checked={createRoomChecked}
                    onChange={() => {
                      if (!createRoomChecked && joinRoomChecked) {
                        this.setState({ joinRoomChecked: !joinRoomChecked });
                      }
                      this.setState({ createRoomChecked: !createRoomChecked });
                    }}
                  />
                }
                label={<Typography id="createRoom">Create Room</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={joinRoomChecked}
                    onChange={() => {
                      if (createRoomChecked && !joinRoomChecked) {
                        this.setState({
                          createRoomChecked: !createRoomChecked,
                        });
                      }
                      this.setState({ joinRoomChecked: !joinRoomChecked });
                    }}
                  />
                }
                label={<Typography id="joinRoom">Join Room</Typography>}
              />
            </FormGroup>
            {createRoomChecked ? (
              <>
                <Button
                  onClick={() => {
                    this.setState({ room: uuidv4() }, () => {
                      this.setState({ roomIdGenerated: true }, () => {
                        this.joinRoom();
                      });
                    });
                  }}
                  variant="contained"
                  color="primary"
                  id="generateButton"
                >
                  Generate Room Id
                </Button>
              </>
            ) : null}
            {joinRoomChecked ? (
              <>
                <TextField
                  id="roomIDField"
                  value={room}
                  autoFocus={true}
                  placeholder={"Enter Room ID Here..."}
                  onChange={(event) => {
                    this.setState({ room: event.target.value });
                  }}
                />
                <Button
                  id="generateButton"
                  onClick={() => {
                    this.joinRoom();
                    this.setState({ startGame: true });
                  }}
                  variant="contained"
                  color="primary"
                >
                  Join Room
                </Button>
              </>
            ) : null}

            {roomIdGenerated ? (
              <>
                <Typography>{room}</Typography>
              </>
            ) : null}
          </>
        ) : null}
        {startGame ? (
          <>
            <div style={{ position: "absolute", right: "5%", top: "5%" }}>
              <CountdownCircleTimer
                key={this.state.timerKey}
                isPlaying
                duration={this.state.timerDuration}
                size={120}
                colors={[
                  ["#004777", 0.33],
                  ["#F7B801", 0.33],
                  ["#A30000", 0.33],
                ]}
                onComplete={(totalElapseTime) => {
                  console.log("Ended");
                  this.setState({ isPressMeButtonDisabled: true });
                  this.state.socketIO.disconnect();
                }}
              >
                {({remainingTime}) => {
                  return (<p style={{color: "white"}}>{remainingTime}</p>)
                }}
              </CountdownCircleTimer>
            </div>
            {this.state.isPressMeButtonDisabled && (
              <>
                <div
                  style={{
                    // margin: "5%",
                    // position: 'absolute',
                    backgroundColor: "red",
                    borderRadius: 20,
                    padding: 35,
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                    margin: "5%",
                  }}
                >
                  <Typography variant="h1">GAME OVER</Typography>
                </div>
              </>
            )}
            <Typography
              variant="h4"
              id="score"
            >{`Highest Score: ${highestScore}`}</Typography>
            <Typography id="roomIDDisplay">{`Room ID: ${room}`}</Typography>
            <Typography>{`This room now has ${users.length} players`}</Typography>
            { lastEvent?.count > 0 && 
              <Typography>{`${users.filter(u => u.uid === lastEvent.lastUid)[0]?.name} increased the count to ${lastEvent.count}!`}</Typography>
            }
            <Typography variant="h1" id="textEffect">
              {count}
            </Typography>
            <Button
              id="generateButton"
              type="submit"
              variant="contained"
              color="primary"
              disabled={this.state.isPressMeButtonDisabled}
              onClick={() => {
                this.handleButtonPress();
              }}
            >
              Press Me
            </Button>
          </>
        ) : null}
      </div>
    );
  }
}

export default Main;
