import test from 'node:test';
import assert from 'node:assert/strict';
import * as flip from '../src/peer.js';
import * as clue from '../../cluance/src/peer.js';
test('shared pairing codecs remain scoped to their game and bind replies to a room',async()=>{
  for(const codec of[flip,clue]){
    const offer=await codec.encodePairing({type:'offer',sdp:'v=0\r\n'},'0123456789abcdef');
    const url=codec.makeLink(offer,'offer','https://example.com/game/');
    const decoded=await codec.decodePairing(url,'offer');assert.equal(decoded.room,'0123456789abcdef');
    await assert.rejects(()=>codec.decodePairing(url,'answer'));
    const other=codec===flip?clue:flip;await assert.rejects(()=>other.decodePairing(url,'offer'));
  }
  const reply=await flip.encodePairing({type:'answer',sdp:'v=0\r\n'},'0123456789abcdef');
  const fake={room:'ffffffffffffffff',pc:{signalingState:'have-local-offer',setRemoteDescription(){throw Error('Should not be applied');}}};
  await assert.rejects(()=>flip.PeerLink.prototype.accept.call(fake,reply),/another table/);
});
