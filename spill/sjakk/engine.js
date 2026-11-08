// Stockfish WebAssembly, UCI protocol. One queue keeps gameplay and analysis from
// accidentally consuming each other's search results.
export class ChessEngine {
  constructor() {
    this.worker=null;this.ready=false;this.queue=[];this.active=null;this.listeners=[];
    this.startWorker();
  }
  startWorker(){
    try {
      this.worker=new Worker('./stockfish-lite.js');
      this.worker.onmessage=e=>this.receive(String(e.data));
      this.worker.onerror=()=>{this.ready=false;this.failAll('Stockfish kunne ikke startes på denne enheten.')};
      this.worker.postMessage('uci');
    } catch(e) {this.failAll('Nettleseren støtter ikke Stockfish: '+e.message)}
  }
  onReady(fn){this.listeners.push(fn);if(this.ready)fn()}
  receive(data){for(const line of data.split(/\r?\n/)){if(line.includes('uciok')){this.ready=true;this.listeners.forEach(fn=>fn());this.next()}if(!this.active)continue;const info=line.match(/\bscore (cp|mate) (-?\d+)/);if(line.startsWith('info ')&&info){this.active.score=info[1]==='mate'?(Number(info[2])>0?100000:-100000):Number(info[2]);this.active.depth=Number(line.match(/\bdepth (\d+)/)?.[1]||0)}if(line.startsWith('bestmove ')){const move=line.split(/\s+/)[1];const active=this.active;this.active=null;clearTimeout(active.timer);active.resolve({move,score:active.score??0,depth:active.depth??0});this.next()}}}
  next(){if(!this.ready||this.active||!this.queue.length)return;const task=this.queue.shift();this.active=task;this.worker.postMessage('setoption name Skill Level value '+task.skill);this.worker.postMessage('position fen '+task.fen);this.worker.postMessage('go movetime '+task.ms);task.timer=setTimeout(()=>{
    if(this.active!==task)return;
    // A suspended iPhone worker may never send bestmove after stop. Reject
    // the stalled search and start a fresh worker instead of hanging forever.
    this.active=null;this.ready=false;this.worker?.terminate();this.worker=null;
    task.reject(new Error('Stockfish brukte for lang tid. Stillingen ble hoppet over.'));
    this.startWorker();
  },Math.max(5500,task.ms+4500))}
  search(fen,{ms=350,skill=20}={}){if(!this.worker)return Promise.reject(new Error('Stockfish er ikke tilgjengelig.'));return new Promise((resolve,reject)=>{this.queue.push({fen,ms,skill,resolve,reject});this.next()})}
  failAll(message){if(this.active){this.active.reject(new Error(message));this.active=null}for(const t of this.queue)t.reject(new Error(message));this.queue=[]}
}
