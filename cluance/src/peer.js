import {PROTOCOL} from './game.js';
import {DECKS} from './decks.js';
import {createPeerTransport} from '../../shared/peer.js';
export const {PeerLink, encodePairing, decodePairing, makeLink, iceConfig} = createPeerTransport({protocol:PROTOCOL, prefix:'CL1', gameName:'Cluance', channelName:'cluance', wireKey:'version'});

export function invitationDetails(input) {
  const params = String(input).includes('#')
    ? new URLSearchParams(new URL(input).hash.slice(1))
    : new URLSearchParams();
  const role = params.get('role') || 'giver';
  let options;
  if (['theme', 'clueTheme', 'variant'].some(key => params.has(key))) {
    options = {theme:params.get('theme'), clueTheme:params.get('clueTheme'), variant:params.get('variant')};
  }
  return validateInvitationDetails({role,options});
}
export function validateInvitationDetails({role,options}) {
  if (!['giver', 'guesser'].includes(role)) throw new Error('This invitation has an invalid player role. Ask for a fresh invitation.');
  if(options&&(!Object.hasOwn(DECKS, options.theme) || !Object.hasOwn(DECKS, options.clueTheme) || !['classic', 'fixed'].includes(options.variant)))
    throw new Error('This invitation has incompatible table settings. Ask for a fresh invitation.');
  if (role === 'guesser' && !options) throw new Error('This invitation is missing its table settings. Ask for a fresh invitation.');
  return {role, options};
}

export function makeInvitationLink(token, role, options, base = location.href) {
  const url = new URL(makeLink(token, 'offer', base));
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of Object.entries({role, ...options})) params.set(key, value);
  url.hash = params.toString();
  invitationDetails(url.href);
  return url.href;
}
