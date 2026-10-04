import test from 'node:test';
import assert from 'node:assert/strict';
import {fitRect} from '../floating-windows.js';
test('a window stays reachable after shrinking to a phone viewport',()=>{
  assert.deepEqual(fitRect({x:1100,y:700,width:500,height:500},{x:0,y:0,width:320,height:400},{width:280,height:300}),{x:8,y:8,width:304,height:384});
});
test('minimum sizes and visual viewport offsets keep controls reachable above the keyboard',()=>{
  assert.deepEqual(fitRect({x:-50,y:-100,width:1,height:1},{x:20,y:100,width:360,height:320},{width:280,height:300}),{x:28,y:108,width:280,height:300});
});
test('a launcher cannot be dragged beyond any edge',()=>{
  assert.deepEqual(fitRect({x:999,y:999,width:64,height:60},{x:0,y:0,width:320,height:844}),{x:248,y:776,width:64,height:60});
});

import {normalizeRoomCode} from '../room-code.js';
test('room codes accept lowercase and separators, and reject ambiguous or invalid values',()=>{
  assert.equal(normalizeRoomCode(' k7qm - 4xpn '),'K7QM4XPN');
  assert.equal(normalizeRoomCode('ABCD EFGH'),'ABCDEFGH');
  for(const value of ['ABCD-EFGI','01234567','too-long-code',null,12345678,'https://example.com'])assert.equal(normalizeRoomCode(value),null);
});
