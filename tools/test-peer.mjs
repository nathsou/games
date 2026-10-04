// Browser-test-only RTC substitute. The real signaling service still runs.
// Gameplay uses an in-browser channel so tests do not require TURN credentials.
export function installTestPeer(){
  window.__testPeers=[];
  class Channel extends EventTarget {
    constructor(pc){super();this.pc=pc;this.readyState='connecting';this.bufferedAmount=0;}
    send(data){this.pc.bus.postMessage({type:'data',from:this.pc.id,to:this.pc.remote,data});}
    close(){if(this.readyState==='closed')return;this.readyState='closed';this.dispatchEvent(new Event('close'));}
    open(){this.readyState='open';this.dispatchEvent(new Event('open'));}
  }
  class Connection extends EventTarget {
    constructor(config){
      super();window.__testPeers.push(this);this.config=config;this.id=crypto.randomUUID();this.signalingState='stable';this.connectionState='new';this.iceGatheringState='complete';
      this.bus=new BroadcastChannel('games-cloudflare-browser-audit');
      this.bus.onmessage=({data})=>{
        if(data.to!==this.id)return;
        if(data.type==='connect')this.open();
        if(data.type==='data'){const e=new Event('message');e.data=data.data;this.channel.dispatchEvent(e);}
        if(data.type==='close'){this.connectionState='disconnected';this.channel?.close();this.dispatchEvent(new Event('connectionstatechange'));}
      };
    }
    createDataChannel(){return this.channel=new Channel(this);}
    getConfiguration(){return this.config;}
    addTrack(track,stream){this.media=true;this.stream=stream;}
    async createOffer(){return {type:'offer',sdp:'v=0\r\n'+(this.media?'media\r\n':'')+this.id};}
    async createAnswer(){return {type:'answer',sdp:'v=0\r\n'+(this.media?'media\r\n':'')+this.id};}
    async setLocalDescription(d){
      this.localDescription=d;this.signalingState=d.type==='offer'?'have-local-offer':'stable';
      const e=new Event('icecandidate');e.candidate={toJSON:()=>({candidate:'candidate:browser-test',sdpMid:'0',sdpMLineIndex:0})};this.dispatchEvent(e);
    }
    async setRemoteDescription(d){
      this.remoteDescription=d;this.remote=d.sdp.trim().split('\n').at(-1);
      if(d.type==='offer'){
        this.signalingState='have-remote-offer';
        if(d.sdp.includes('\r\nmedia\r\n')){
          this.media=true;const e=new Event('track');e.streams=[window.__testDisplayStream];this.dispatchEvent(e);
        }else {const e=new Event('datachannel');e.channel=this.createDataChannel();this.dispatchEvent(e);}
      }
      else {this.signalingState='stable';this.bus.postMessage({type:'connect',to:this.remote});this.open();}
    }
    async addIceCandidate(){}
    open(){this.connectionState='connected';this.dispatchEvent(new Event('connectionstatechange'));this.channel?.open();}
    close(){if(this.signalingState==='closed')return;this.bus.postMessage({type:'close',to:this.remote});this.signalingState='closed';this.connectionState='closed';this.channel?.close();this.bus.close();}
  }
  window.RTCPeerConnection=Connection;
}

// Browser-test-only capture substitute. Assertions cover negotiation, control
// and lifecycle; this stream does not establish native screen/video delivery.
export function installTestDisplay() {
  window.__testCaptureStreams = [];
  function stream() {
    const canvas = document.createElement('canvas');
    canvas.width = innerWidth; canvas.height = innerHeight;
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
    return canvas.captureStream(1);
  }
  window.__testDisplayStream = stream();
  navigator.mediaDevices.getDisplayMedia = async () => {
    const capture = stream(), handle = window.__friendSession.screen.id;
    capture.getVideoTracks()[0].getCaptureHandle = () => ({handle, origin: location.origin});
    window.__testCaptureStreams.push(capture);
    return capture;
  };
}
