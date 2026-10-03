import {createPeerTransport} from '../../shared/peer.js';
export const PROTOCOL = 5;
export const {PeerLink, encodePairing, decodePairing, makeLink, randomHex, iceConfig} = createPeerTransport({protocol:PROTOCOL, prefix:'FI1', gameName:'Flip it', channelName:'flip-it'});
