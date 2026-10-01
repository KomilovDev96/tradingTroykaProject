import type { WebSocket, WebSocketServer } from 'ws';

export class Hub {
  private clients = new Set<WebSocket>();

  attach(wss: WebSocketServer) {
    wss.on('connection', (socket) => {
      this.clients.add(socket);
      socket.on('close', () => this.clients.delete(socket));
    });
  }

  broadcast(message: unknown) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }
}
