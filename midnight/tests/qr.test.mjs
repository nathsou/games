import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {qrMatrix} from '../src/qr.js';

// Every fixture was decoded independently by macOS Vision, and its decoded
// bytes matched the input. These cover all seven version profiles.
const fixtures = [
  {
    "length": 10,
    "size": 21,
    "hash": "a6a99ef8d7d444b2aa77112fac736dcb70f3d1070fb9988a5a81c706e5586e4f"
  },
  {
    "length": 100,
    "size": 57,
    "hash": "6f7c73c8dc0483807663a9bdc85bd1e5e8d7bb6cbe556e44f13e41d3148c872e"
  },
  {
    "length": 300,
    "size": 77,
    "hash": "d11104faa4e375a059cd8e282c50b739430367986450cd16fc45c4cea36e233f"
  },
  {
    "length": 700,
    "size": 97,
    "hash": "d95e0843855b2fcc533f71fc9d0d129e7d49d0af77f5de0961b886b2001a46bc"
  },
  {
    "length": 1100,
    "size": 117,
    "hash": "6103e1e1514849b1fae36e1a1c2c2d5324556bfcd5e022b328bee46596a76dd2"
  },
  {
    "length": 1500,
    "size": 137,
    "hash": "155e51ee2a3ddee82dcc4d71571dfb018901955f04af86d4ff58b0803d2671a1"
  },
  {
    "length": 2500,
    "size": 177,
    "hash": "a17fcd93af069b136267ab0c181baf96d6fc0eb5a436e6caa1fbb9a4f5c5c09e"
  }
];
test('QR symbols match independently decoded profile fixtures', () => {
  for (const {length,size,hash} of fixtures) {
    const text = length === 10 ? 'midnight!!' : 'https://example.com/midnight/#invite=' + 'MT1z.abcDEFG123_-'.repeat(180).slice(0,length-35);
    const matrix=qrMatrix(text);
    assert.equal(matrix.length,size);
    assert(matrix.every(row=>row.length===size&&row.every(b=>typeof b==='boolean')));
    const actual=createHash('sha256').update(matrix.map(row=>row.map(Number).join('')).join('\n')).digest('hex');
    assert.equal(actual,hash);
  }
});
test('QR limits count UTF-8 bytes and reject oversized share links', () => {
  assert.equal(qrMatrix('a'.repeat(2953)).length,177);
  assert.throws(()=>qrMatrix('a'.repeat(2954)),/too long/);
  assert.throws(()=>qrMatrix('✦'.repeat(1000)),/too long/);
});
