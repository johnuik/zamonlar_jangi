// Tarmoq ulanishi (WebSocket)
export class Net {
  constructor() { this.ws = null; this.onmsg = null; this.onclose = null; }

  connect() {
    return new Promise((resolve, reject) => {
      if (location.protocol === 'file:') { reject(new Error('file')); return; }
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      let done = false;
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      const to = setTimeout(() => { if (!done) { done = true; ws.close(); reject(new Error('timeout')); } }, 4000);
      ws.onopen = () => { if (done) return; done = true; clearTimeout(to); resolve(); };
      ws.onerror = () => { if (done) return; done = true; clearTimeout(to); reject(new Error('ws')); };
      ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.onclose && this.onclose(); } };
      ws.onmessage = (e) => { let o; try { o = JSON.parse(e.data); } catch (err) { return; } this.onmsg && this.onmsg(o); };
      this.ws = ws;
    });
  }
  get connected() { return !!this.ws && this.ws.readyState === 1; }
  send(o) { if (this.connected) this.ws.send(JSON.stringify(o)); }
  close() {
    if (!this.ws) return;
    const ws = this.ws; this.ws = null;
    try { ws.send(JSON.stringify({ t: 'leave' })); } catch (e) { /* e'tiborsiz */ }
    ws.onmessage = null;   // yopilayotgan ulanishdan kechikib kelgan xabar (masalan, "jang boshlandi") endi qabul qilinmaydi
    ws.close();
  }
}
