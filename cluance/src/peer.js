import {PROTOCOL} from './game.js';
import {createPeerTransport} from '../../shared/peer.js';
export const {PeerLink, encodePairing, decodePairing, makeLink, iceConfig} = createPeerTransport({protocol:PROTOCOL, prefix:'CL1', gameName:'Cluance', channelName:'cluance', wireKey:'version'});
