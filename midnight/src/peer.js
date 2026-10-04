import {createPeerTransport} from '../../shared/peer.js';
export const PROTOCOL=1;
export const {PeerLink,encodePairing,decodePairing,makeLink,randomHex,iceConfig}=createPeerTransport({protocol:PROTOCOL,prefix:'MT1',gameName:'Midnight Table',channelName:'midnight'});
