// Shared invitation UI: each game supplies its theme and game-specific setup.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label, action, busy, style='secondary') => `<button type="button" class="button ${style}" data-action="${action}" ${busy?'disabled':''}>${label}</button>`;
export function connectionSettings(stun='stun:stun.l.google.com:19302') {
  return `<details class="connection-settings"><summary>Connection settings</summary><p class="help-text">STUN helps browsers find each other. Use a TURN relay on networks that block direct connections. Leave STUN blank for local networks.</p><label class="field-label label" for="stun">STUN ADDRESS</label><input id="stun" spellcheck="false" value="${esc(stun)}"><label class="field-label label" for="turn">OPTIONAL TURN RELAY</label><input id="turn" placeholder="turn:your-relay.example:3478" spellcheck="false"><label class="field-label label" for="turn-name">RELAY USERNAME</label><input id="turn-name" autocomplete="off"><label class="field-label label" for="turn-password">RELAY PASSWORD · THIS SESSION ONLY</label><input id="turn-password" type="password" autocomplete="off"></details>`;
}
export function pairingBody({host, output='', busy=false, error='', message='', initial='', setup='', stun, canScan=false}) {
  const settings=connectionSettings(stun), kind=host?'INVITE':'REPLY';
  const steps=host?['Share invite','Paste reply','Play']:['Paste invite','Send reply','Play'];
  let html='<div class="pair-steps" aria-label="Connection steps">'+steps.map((label,i)=>`<div class="pair-step ${i===(output?1:0)?'active':output&&i===0?'done':''}" ${i===(output?1:0)?'aria-current="step"':''}>0${i+1}<br>${label}</div>`).join('')+'</div>';
  if(output) {
    html+=`<p class="modal-copy pair-copy">${host?'Send this invitation to your friend, or let them scan the QR code.':'Send this reply to the host. They can open it beside their hosting tab or paste it.'} Keep this tab open.</p><div class="pair-output-grid"><div><label class="field-label label" for="pair-output">YOUR ${kind} LINK</label><textarea id="pair-output" class="link-output code-box" readonly spellcheck="false">${esc(output)}</textarea><div class="button-row">${button('COPY '+kind+' ↗','copy',false,'gold')}${button('SHARE','share',false,'dark')}</div></div><div class="qr-wrap"><canvas id="pair-qr" aria-label="Scan this ${kind.toLowerCase()} QR code"></canvas></div></div>`;
    if(host) html+=`<label class="field-label label" for="pair-input">PASTE YOUR FRIEND’S REPLY LINK</label><textarea id="pair-input" class="code-box" placeholder="Their reply link goes here…" spellcheck="false">${esc(initial)}</textarea>${button(busy?'CONNECTING…':'ACCEPT REPLY →','accept-reply',busy)}${canScan?button('SCAN REPLY QR','scan-reply',busy):''}`;
    else html+='<p class="help-text qr-note">Waiting for the host to accept. Keep this tab open.</p>';
    html+=settings+button(host?'MAKE A FRESH INVITE':'REMAKE REPLY',host?'create-invite':'remake-reply',busy);
  } else if(host) {
    html+=`<p class="modal-copy pair-copy">Send the invite. Your friend opens it and sends a reply. Paste that reply here to start playing.</p>${setup}${settings}${button(busy?'PREPARING INVITATION…':'CREATE INVITATION ↗','create-invite',busy,'gold')}`;
  } else {
    html+=`<p class="modal-copy pair-copy">Open your friend’s invitation link, or paste it below. No account needed.</p><label class="field-label label" for="pair-input">INVITATION LINK</label><textarea id="pair-input" class="code-box" placeholder="Paste the invitation link here…" spellcheck="false">${esc(initial)}</textarea>${settings}${button(busy?'PREPARING YOUR REPLY…':'JOIN THIS TABLE →','join-invite',busy,'gold')}${canScan?button('SCAN INVITATION QR','scan-invite',busy):''}`;
  }
  if(message)html+=`<p class="modal-copy help-text" role="status">${esc(message)}</p>`;
  if(error)html+=`<p class="inline-error" role="alert">${esc(error)}</p>`;
  return html+'<p class="help-text small">A direct browser connection. No account or room server. Keep both tabs open. Relay credentials stay in this session.</p>';
}
export async function copyPairing(field) {
  try {await navigator.clipboard.writeText(field.value);}
  catch {field.focus();field.select();if(!document.execCommand('copy'))throw new Error('Select and copy the link above.');}
}
export async function sharePairing(field, title) {
  if(navigator.share){try{await navigator.share({title,url:field.value});}catch(error){if(error.name!=='AbortError')throw error;}}
  else await copyPairing(field);
}
