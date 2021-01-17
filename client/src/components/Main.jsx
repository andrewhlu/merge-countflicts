import React, { Component } from "react";
import {
  Checkbox,
  FormGroup,
  FormControlLabel,
  TextField,
  Button,
  Typography,
} from "@material-ui/core";

// import ClientComponent from "./ClientComponent";

import socketIOClient from "socket.io-client";
// import openSocket from "socket.io-client";
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

  joinRoom = () => {
    const { room, socketIO } = this.state;
    socketIO.emit("room", room);
    this.setState({ startGame: true });
  };

  handleButtonPress = () => {
    const { id, count, room, socketIO } = this.state;
    // this.setState({ count: count+1});

    const data = {
      id: id, 
      room: room,
      // message: "Hello World",
      count: parseInt(count) + 1,
      timestamp: Date.now(),
    };
    console.log(data);
    socketIO.emit("buttonPress", data);
  };

  render() {
    const {room, count, loadClient, createRoomChecked, joinRoomChecked, roomIdGenerated, startGame, response, socketIO} = this.state;
    return (<>
    {/* <Typography variant="h1">Addiction With Extra Steps</Typography> */}
      {!startGame ? (
        <>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                id = "checkbox"
                  checked={createRoomChecked}
                  onChange={() => {
                    if (!createRoomChecked && joinRoomChecked) {
                      this.setState({joinRoomChecked: !joinRoomChecked});
                    }
                    this.setState({createRoomChecked: !createRoomChecked});
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
                      this.setState({createRoomChecked: !createRoomChecked})
                      // setCreateRoomChecked(!createRoomChecked);
                    }
                    this.setState({joinRoomChecked: !joinRoomChecked})
                    // setJoinRoomChecked(!joinRoomChecked);
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
                  this.setState({room: uuidv4()}, () => {
                    this.setState({roomIdGenerated: true}, () => {
                      this.joinRoom();
                      // this.setState({startGame: true});
                    })
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
                helperText={<Typography id="helpText">Enter Room ID Here...</Typography>}
                onChange={(event) => {
                  this.setState({room: event.target.value});
                  // setRoom(event.target.value);
                }}
              />
              <Button
                id = "generateButton"
                onClick={() => {
                  this.joinRoom();
                  this.setState({startGame: true})
                  // setStartGame(true);
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
              {/* <TextField
          value={room}
          disabled={true}
        /> */}
              </>
            ) : null}
          </>
        ) : null}
        {startGame ? (
          <>
            <Typography id = "roomIDDisplay">{`Room Id: ${room}`}</Typography>
            <Typography variant="h1" id="textEffect">{count}</Typography>
            <Button
              id = "generateButton"
              type="submit"
              variant="contained"
              color="primary"
              onClick={() => {
                this.handleButtonPress();
                // this.setState({count: count+1});
                // setCount(count + 1);
              }}
            >
              Press Me
            </Button>
          </>
        ) : null}
      </>
    );
  }
}

export default Main;
