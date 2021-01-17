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
    };
  }

  componentDidMount() {
    this.setState({ id: generateUniqueNumber() }, () => {
      this.setState(
        { socketIO: socketIOClient(ENDPOINT, { transport: ["websocket"] }) },
        () => {
          this.state.socketIO.on("count", (data) => {
            console.log(data);
            this.setState({ count: data });
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
    const { room, socketIO } = this.state;
    socketIO.emit("room", room);
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

  render() {
    const {
      room,
      count,
      createRoomChecked,
      joinRoomChecked,
      roomIdGenerated,
      startGame,
      highestScore,
    } = this.state;
    return (
      <div>
        {!startGame ? (
          <>
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
                {({ remainingTime }) => remainingTime}
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
