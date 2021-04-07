import {
  Box,
  Button,
  Flex,
  Grid,
  List,
  ListItem,
  Text,
} from '@chakra-ui/react';
import React, { useEffect, useRef, useState } from 'react';
import Peer, { SignalData } from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import './App.css';

function App() {
  const [yourID, setYourID] = useState('');
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState<any>(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const userAudio = useRef<HTMLAudioElement | null>(null);
  const partnerAudio = useRef<HTMLAudioElement | null>(null);
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    socket.current = io('ws://localhost:8000');
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      // set my own stream..
      setStream(stream);
      // if ref was rendered set stream into audio tag srcObject..
      if (userAudio.current) userAudio.current.srcObject = stream;
    });

    socket.current.on('yourID', (id: string) => {
      setYourID(id);
    });

    socket.current.on('allUsers', (users: { [key: string]: string }) => {
      setUsers(users);
    });

    // I'm getting called..
    socket.current.on('hey', (data: any) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, []);

  const callPeer = async (id: string) => {
    if (stream) {
      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'stun:stun.l.google.com:19302',
          },
          {
            urls: 'turn:numb.viagenie.ca',
            credential: 'qweasd',
            username: 'knat.dev.93@gmail.com',
          },
        ],
      });

      stream.getTracks().forEach((track) => pc.addTrack(track));

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        console.log(e.candidate.candidate);
      };

      pc.onicecandidateerror = (e) => {
        console.log(e);
      };

      const offer = await pc.createOffer();
      pc.setLocalDescription(offer);
      console.log(offer);
      setReceiverId('');
      socket.current?.emit('callUser', {
        userToCall: id,
        signalData: offer,
        from: yourID,
      });
      console.log(yourID);
      // const peer = new Peer({
      //   initiator: true,
      //   trickle: false,
      //   stream,
      //   config: {
      //     iceServers: [
      //       {
      //         urls: 'stun:stun.l.google.com:19302?transport=udp',
      //       },
      //     ],
      //   },
      // });

      // peer.on('error', (e) => console.log(e));

      // peer.on('signal', (data) => {
      //   setStartingCall(false);
      //   setReceiverId('');
      //   socket.current?.emit('callUser', {
      //     userToCall: id,
      //     signalData: data,
      //     from: yourID,
      //   });
      // });
      // peer.on('stream', (stream: MediaStream) => {
      //   console.log('got partner stream!');
      //   if (partnerAudio.current) {
      //     partnerAudio.current.srcObject = stream;
      //   }
      // });

      socket.current?.on('callAccepted', (signal: SignalData) => {
        setCallAccepted(true);
        console.log(signal);
      });
    }
  };
  const acceptCall = () => {
    if (stream) {
      setCallAccepted(true);
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            {
              urls: 'stun:stun.l.google.com:19302?transport=tcp',
            },
            {
              urls: 'turn:turn01.hubl.in?transport=tcp',
              credential: 'qweasd',
              username: 'knat.dev.93@gmail.com',
            },
          ],
        },
      });

      peer.on('error', (e) => console.log(JSON.stringify(e)));

      peer.on('signal', (data) => {
        socket.current?.emit('acceptCall', { signal: data, to: caller });
      });

      peer.on('stream', (stream: MediaStream) => {
        if (partnerAudio.current) partnerAudio.current.srcObject = stream;
      });

      peer.signal(callerSignal);
    }
  };

  let UserAudio;
  if (stream) {
    UserAudio = <audio muted autoPlay ref={userAudio} />;
  }

  let PartnerAudio;
  if (callAccepted) {
    PartnerAudio = <audio ref={partnerAudio} autoPlay />;
  }

  let incomingCall;
  if (receivingCall) {
    incomingCall = (
      <div>
        <h1>{caller} is calling you</h1>
        <Button colorScheme="blue" onClick={acceptCall}>
          Accept
        </Button>
      </div>
    );
  }

  return (
    <Grid h="100vh" templateRows="100px auto">
      <Flex align="center" justify="center">
        {UserAudio}
        {PartnerAudio}
        {incomingCall}
      </Flex>
      <Flex justify="center" overflowY="auto">
        <Flex h="100%">
          <Box w="300px">
            <Text fontWeight="bold" fontSize="sm">
              Online Users:
            </Text>
            <List w="100%">
              {Object.keys(users).map((user) =>
                user !== yourID ? (
                  <ListItem key={user} py={2} _last={{ paddingBottom: 0 }}>
                    <Flex justify="space-between" align="center">
                      <Text>{user}</Text>
                      <Button
                        disabled={startingCall}
                        isLoading={startingCall && user === receiverId}
                        colorScheme="green"
                        onClick={() => callPeer(user)}
                      >
                        Call
                      </Button>
                    </Flex>
                  </ListItem>
                ) : null,
              )}
            </List>
          </Box>
        </Flex>
      </Flex>
    </Grid>
  );
}

export default App;
