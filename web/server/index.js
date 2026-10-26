import { createServer } from 'node:http';
import { buildPrompt } from './agent.js';
import { PromData } from './services/prom.service.js';

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  if (request.method !== 'POST' || request.url !== '/api/chat') {
    response.writeHead(404).end(JSON.stringify({ error: 'Ruta no encontrada.' })); return;
  }
  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 200_000) throw new Error('La solicitud excede el tamaño permitido.');
    }
    const payload = JSON.parse(body);
    const answer = await PromData({ message: buildPrompt(payload) });
    response.writeHead(200).end(JSON.stringify({ answer }));
  } catch (error) {
    const message = error instanceof SyntaxError ? 'El cuerpo JSON no es válido.' : error.message;
    const badRequest = error instanceof SyntaxError
      || /mensaje es obligatorio|historial inválido|historial contiene|excede el tamaño/i.test(message);
    const status = badRequest ? 400 : /Falta OPENROUTER_API_KEY/.test(message) ? 500 : 502;
    response.writeHead(status).end(JSON.stringify({ error: message }));
  }
});

const port = Number(process.env.API_PORT || 3001);
server.listen(port, () => console.log(`API disponible en http://localhost:${port}`));
