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
import { SignalData } from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import './App.css';

function App() {
  const [yourID, setYourID] = useState('');
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callingUser, setCallingUser] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [caller, setCaller] = useState('');
  const [callAccepted, setCallAccepted] = useState(false);

  const userAudio = useRef<HTMLAudioElement | null>(null);
  const partnerAudio = useRef<HTMLAudioElement | null>(null);
  const socket = useRef<Socket | null>(null);

  // Signle peer per client
  const peer = useRef<RTCPeerConnection>(
    new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    }),
  );

  useEffect(() => {
    socket.current = io('ws://localhost:8000');
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      // set my own stream..
      setStream(stream);
      // if ref was rendered set stream into audio tag srcObject..
      if (userAudio.current) {
        userAudio.current.srcObject = stream;
      }

      stream
        .getTracks()
        .forEach((track) => peer.current?.addTrack(track, stream));
      console.log(partnerAudio.current);

      peer.current.ontrack = (e) => {
        console.log(e);
        if (partnerAudio.current) partnerAudio.current.srcObject = e.streams[0];
      };

      peer.current.onicecandidateerror = (e) => {
        console.log(e);
      };
    });

    socket.current.on('yourID', (id: string) => {
      setYourID(id);
    });

    socket.current.on('allUsers', (users: { [key: string]: string }) => {
      setUsers(users);
    });

    socket.current.on('hey', async (data: any) => {
      console.log(data.signal);
      setTimeout(async () => {
        await peer.current?.setRemoteDescription(
          new RTCSessionDescription(data.signal),
        );
      }, 1000);
      setReceivingCall(true);
      setCaller(data.from);
    });

    socket.current.on('onicecandidate', async (candidate: RTCIceCandidate) => {
      try {
        await peer.current?.addIceCandidate(candidate);
      } catch (e) {}
    });

    socket.current?.on('callAccepted', async (signal: SignalData) => {
      setCallAccepted(true);
      await peer.current?.setRemoteDescription(signal);
      console.log(signal);
    });

    socket.current.on('rejectCall', () => {
      setCallingUser(false);
      setReceivingCall(false);
    });

    return () => {
      socket.current?.off('callAccepted');
      socket.current?.off('onicecandidate');
      socket.current?.disconnect();
    };
  }, []);

  const callPeer = async (id: string) => {
    if (stream && peer.current) {
      setReceiverId(id);
      setCallingUser(true);

      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);

      // peer.current.ontrack = (e) => {
      //   console.log(e);
      //   if (partnerAudio.current) partnerAudio.current.srcObject = e.streams[0];
      // };

      peer.current.onicecandidate = (e) => {
        if (!e.candidate) return;
        socket.current?.emit('onicecandidate', {
          candidate: e.candidate,
          to: id,
        });
      };

      console.log(offer);
      socket.current?.emit('callUser', {
        userToCall: id,
        signalData: offer,
        from: yourID,
      });
    }
  };

  const acceptCall = async () => {
    setCallAccepted(true);

    setTimeout(async () => {
      if (stream && peer.current) {
        const answer = await peer.current.createAnswer();
        peer.current.setLocalDescription(new RTCSessionDescription(answer));

        peer.current.onicecandidate = (e) => {
          socket.current?.emit('onicecandidate', {
            candidate: e.candidate,
            to: caller,
          });
        };

        socket.current?.emit('acceptCall', {
          signal: answer,
          to: caller,
        });
      }
    }, 1000);
  };

  const rejectCall = async (initiator: boolean) => {
    setCallingUser(false);
    setReceivingCall(false);
    if (peer.current) {
      socket.current?.emit('rejectCall', {
        to: initiator ? receiverId : caller,
        from: yourID,
      });
    }
  };

  let UserAudio;
  if (stream) {
    UserAudio = <audio hidden muted ref={userAudio} />;
  }

  let PartnerAudio;
  PartnerAudio = <audio hidden ref={partnerAudio} autoPlay />;

  let incomingCall;
  if (receivingCall) {
    incomingCall = (
      <div>
        <h1>{caller} is calling you</h1>
        <Flex>
          <Button mr={2} colorScheme="blue" onClick={acceptCall}>
            Accept
          </Button>
          <Button colorScheme="red" onClick={() => rejectCall(false)}>
            Decline
          </Button>
        </Flex>
      </div>
    );
  }

  return (
    <Grid h="100vh" templateRows="100px auto">
      <Flex align="center" justify="center">
        {UserAudio}
        {PartnerAudio}
        {incomingCall}
        {callingUser && (
          <Button colorScheme="red" onClick={() => rejectCall(true)}>
            Decline
          </Button>
        )}
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
