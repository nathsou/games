// Optional live evaluation. No key is written to the repo or report.
import {readFile,writeFile} from 'node:fs/promises';
import {createMatch,makeDeck,valueOf,legalActions as flipActions} from '../../../flip-it/src/rules.js';
import {describeTurn as flipTurn} from '../../../flip-it/src/ai.js';
import {createGame} from '../../../midnight/src/rules.js';
import {describeTurn as midnightTurn} from '../../../midnight/src/ai.js';
import {buildTurnRequest} from '../turn.js';
import {headers,request,responseText} from '../client.js';
const keyFile=process.argv[process.argv.indexOf('--key-file')+1];
let key=process.env.OPENAI_API_KEY;
if(process.argv.includes('--key-file')) {
  const env=await readFile(keyFile,'utf8');
  const found=env.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$/m);
  if(found)key=found[1].replace(/^(['"])(.*)\1$/,'$2').replace(/\s+#.*$/,'');
}
if(!key)throw new Error('Provide OPENAI_API_KEY or --key-file.');
function fixture({hands,table,options={},pending=null,turn=0}) {
  const game=createMatch(options,44,0,hands.length),pool=makeDeck(game.options.compactDeck);
  function card(rank){const i=pool.findIndex(c=>c.ends.includes(rank));if(i<0)throw new Error('Fixture exhausted rank');const c=pool.splice(i,1)[0];c.face=c.ends.indexOf(rank);return c;}
  game.hands=hands.map(h=>h.map(card));game.table=table.map(row=>row.map(h=>h.map(card)));game.discard=pool;game.turn=turn;game.pending=pending;game.repliesRemaining=pending===null?0:hands.length-1;return game;
}
const win=fixture({hands:[[5],[2,4]],table:[[[],[]],[[3],[]]],options:{lastChance:false}});
const counter=fixture({hands:[[],[5,5,1]],table:[[[3,3],[]],[[],[]]],pending:0,turn:1});
const multi=fixture({hands:[[],[5,5,1],[2],[4]],table:[[[3,3],[]],[[],[]],[[],[]],[[],[]]],pending:0,turn:1});
const bid=createGame('backhand',11);bid.prizes[0]=3;bid.prizes[1]=1;bid.carry=3;
const close=createGame('closing',15);close.phase='clock';close.turn=1;close.auctions[0].cubes=[1,2];close.auctions[0].clock=2;close.auctions[0].value=3;close.invested=close.auctions[1].id;
const raid=createGame('heist',6);raid.round=4;raid.phase='raid';raid.used[0]=['alarm','alarm','alarm','bluff'];raid.hands[0]=raid.hands[0].filter(c=>c.kind==='bluff').slice(0,2);raid.hands[1]=raid.hands[1].slice(0,2);raid.guards=[raid.hands[0][0].id,raid.hands[1][0].id];
const cases=[
  {name:'flip_immediate_win',d:flipTurn(win,0),check:a=>a.kind==='play'&&a.cards.length===1},
  {name:'flip_necessary_counter',d:flipTurn(counter,1),check:a=>a.kind==='play'&&a.cards.length===2},
  {name:'flip_four_seat_counter',d:flipTurn(multi,1),check:a=>a.kind==='play'&&a.cards.length===2},
  {name:'backhand_high_prize',d:midnightTurn(bid,1),check:a=>bid.hands[1].find(c=>c.id===a.card)?.value>=4},
  {name:'closing_guaranteed_three_points',d:midnightTurn(close,1),check:a=>a.kind==='tick'&&a.lot===close.auctions[0].id},
  {name:'heist_no_alarms_remain',d:midnightTurn(raid,1),check:a=>a.choice==='raid'}
];
const versions=process.argv.includes('--refined-only')?[{name:'named-public-outcomes',prepare:d=>d}]:[{name:'rules-only',prepare:d=>({...d,rules:d.rules})},{name:'payoff-and-counter-check',prepare:d=>({...d,rules:d.rules+' Before choosing, check whether any candidate wins now, prevents the pending player winning, guarantees an immediate score, or exploits a publicly exhausted defense. In simultaneous games optimize final score DIFFERENCE and preserve useful future cards. In Flip it an empty own hand does not defeat an earlier pending winner unless you return cards to that pending hand.'})}];
const results=[];
for(const version of versions)for(const c of cases) {
  const settings={provider:'openai',models:{openai:'gpt-6-luna'},efforts:{openai:'low'},tokenBudget:4096};
  const {url,body}=buildTurnRequest(settings,version.prepare(c.d));
  const started=Date.now();
  const data=await request(url,{method:'POST',headers:headers('openai',key),body:JSON.stringify(body),signal:AbortSignal.timeout(90000)},key);
  if(data.model&&!data.model.startsWith('gpt-6-luna'))throw new Error('Evaluation returned an unexpected model.');
  let move;try{move=JSON.parse(responseText('openai',data));}catch{move={};}
  const valid=Number.isInteger(move.choice)&&!!c.d.candidates[move.choice]&&typeof move.rationale==='string'&&move.rationale.length<=400;
  const action=valid?c.d.candidates[move.choice].action:null;
  const result={prompt:version.name,case:c.name,model:data.model||'gpt-6-luna',valid,tacticalPass:valid&&c.check(action),action,rationale:move.rationale,ms:Date.now()-started,usage:data.usage};
  results.push(result);console.log(JSON.stringify({prompt:result.prompt,case:result.case,valid:result.valid,tacticalPass:result.tacticalPass,ms:result.ms}));
  await writeFile(new URL(process.argv.includes('--refined-only')?'../EVALUATION_REFINED.json':'../EVALUATION.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),model:'gpt-6-luna',effort:'low',results},null,2)+'\n');
}
console.log(JSON.stringify({total:results.length,valid:results.filter(r=>r.valid).length,tacticalPass:results.filter(r=>r.tacticalPass).length}));
