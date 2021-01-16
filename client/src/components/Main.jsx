// import React, { useState, useEffect } from "react";
// import {
//   Checkbox,
//   FormGroup,
//   FormControlLabel,
//   TextField,
//   Button,
//   Typography,
// } from "@material-ui/core";

// // import ClientComponent from "./ClientComponent";

// import socketIOClient from "socket.io-client";
// // import openSocket from "socket.io-client";
// const ENDPOINT = "http://192.168.4.26:3001";

// function uuidv4() {
//   return "xxxxxxxx".replace(/[xy]/g, function (c) {
//     var r = (Math.random() * 16) | 0,
//       v = c === "x" ? r : (r & 0x3) | 0x8;
//     return v.toString(16);
//   });
// }

// function Main() {
//   const [room, setRoom] = useState("");
//   const [count, setCount] = useState(0);
//   const [loadClient, setLoadClient] = useState(true);

//   const [createRoomChecked, setCreateRoomChecked] = useState(false);
//   const [joinRoomChecked, setJoinRoomChecked] = useState(false);

//   const [roomIdGenerated, setRoomIdGenerated] = useState(false);

//   const [startGame, setStartGame] = useState(false);

//   const [response, setResponse] = useState("");
//   const [socket, setSocket] = useState();

//   useEffect(() => {
//     setSocket(socketIOClient(ENDPOINT, {transport: ['websocket']}));
//     socket.on("FromAPI", data => {
//       setResponse(data);
//     });

//     return () => socket.disconnect();
//   }, []);

//   const joinRoom = (room) => {
//     const socket = socketIOClient(ENDPOINT, {transport: ['websocket']});
//     socket.on('connection', socket)
//   }


//   return (
//     <>
//       {!startGame ? (
//         <>
//           <FormGroup row>
//             <FormControlLabel
//               control={
//                 <Checkbox
//                   checked={createRoomChecked}
//                   onChange={() => {
//                     if (!createRoomChecked && joinRoomChecked) {
//                       setJoinRoomChecked(!joinRoomChecked);
//                     }
//                     setCreateRoomChecked(!createRoomChecked);
//                   }}
//                 />
//               }
//               label="Create Room"
//             />
//             <FormControlLabel
//               control={
//                 <Checkbox
//                   checked={joinRoomChecked}
//                   onChange={() => {
//                     if (createRoomChecked && !joinRoomChecked) {
//                       setCreateRoomChecked(!createRoomChecked);
//                     }
//                     setJoinRoomChecked(!joinRoomChecked);
//                   }}
//                 />
//               }
//               label="Join Room"
//             />
//           </FormGroup>
//           {createRoomChecked ? (
//             <>
//               <Button
//                 onClick={() => {
//                   setRoom(uuidv4());
//                   setRoomIdGenerated(true);
//                   setStartGame(true);
//                 }}
//                 variant="contained"
//                 color="primary"
//               >
//                 Generate Room Id
//               </Button>
//             </>
//           ) : null}
//           {joinRoomChecked ? (
//             <>
//               <TextField
//                 value={room}
//                 autoFocus={true}
//                 helperText={"Enter Room Id Here..."}
//                 onChange={(event) => {
//                   setRoom(event.target.value);
//                 }}
//               />
//               <Button
//                 onClick={() => {
//                   setStartGame(true);
//                 }}
//                 variant="contained"
//                 color="primary"
//               >
//                 Join Room
//               </Button>
//             </>
//           ) : null}

//           {roomIdGenerated ? (
//             <>
//               <Typography>{room}</Typography>
//               {/* <TextField
//           value={room}
//           disabled={true}
//         /> */}
//             </>
//           ) : null}
//         </>
//       ) : null}
//       {startGame ? (
//         <>
//           <Typography>{`Room Id: ${room}`}</Typography>
//           <Typography variant="h1">{count}</Typography>
//           <Button
//             type="submit"
//             variant="contained"
//             color="primary"
//             onClick={() => {
//               setCount(count + 1);
//             }}
//           >
//             Press Me
//           </Button>
//         </>
//       ) : null}
//     </>
//     // {/* <Typography variant="h1">{count}</Typography>
//     // <Button
//     //   type="submit"
//     //   variant="contained"
//     //   color="primary"
//     //   onClick={() => {
//     //     setCount(count + 1);
//     //   }}
//     // >
//     //   Press Me
//     // </Button> */}
//     // {/* LOAD OR UNLOAD THE CLIENT */}
//     // {/* <button onClick={() => setLoadClient((prevState) => !prevState)}>
//     //   STOP CLIENT
//     // </button> */}
//     // {/* SOCKET IO CLIENT*/}
//     // {/* {loadClient ? <ClientComponent /> : null} */}
//   );
// }

// export default Main;

import React, { Component } from 'react';
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
const ENDPOINT = "http://192.168.4.26:3001";

function uuidv4() {
  return "xxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class Main extends Component {
  constructor(props) {
    super(props);
    this.state = {
      room: '',
      count: 0,
      loadClient: true,
      createRoomChecked: false,
      joinRoomChecked: false,
      roomIdGenerated: false,
      startGame: false,
      response: "",
      socketIO: null
    }
  }

  componentDidMount() {
    this.setState({socketIO: socketIOClient(ENDPOINT, {transport: ['websocket']})}, () => {
      this.state.socketIO.on("reset", data => {
        if (data === true) {
          this.setState({count: 0});
        } else {
          this.setState({count: this.state.count+1});
        }
      });
    });

    return () => this.socketIO.disconnect();
  }

  joinRoom = () => {
    const { room, socketIO } = this.state;
    socketIO.emit('room', room);
    this.setState({startGame: true});
  }

  handleButtonPress = () => {
    const { count, room, socketIO } = this.state;
    // this.setState({ count: count+1});

    const data = {
      room: room,
      message: "Hello World",
      timestamp: Date.now()
    };
    console.log(data);
    socketIO.emit('buttonPress', data)      
  }



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
                  checked={createRoomChecked}
                  onChange={() => {
                    if (!createRoomChecked && joinRoomChecked) {
                      this.setState({joinRoomChecked: !joinRoomChecked});
                    }
                    this.setState({createRoomChecked: !createRoomChecked});
                  }}
                />
              }
              label="Create Room"
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
              label="Join Room"
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
              >
                Generate Room Id
              </Button>
            </>
          ) : null}
          {joinRoomChecked ? (
            <>
              <TextField
                value={room}
                autoFocus={true}
                helperText={"Enter Room Id Here..."}
                onChange={(event) => {
                  this.setState({room: event.target.value});
                  // setRoom(event.target.value);
                }}
              />
              <Button
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
          <Typography>{`Room Id: ${room}`}</Typography>
          <Typography variant="h1">{count}</Typography>
          <Button
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
    </>)
  };

}

export default Main;
