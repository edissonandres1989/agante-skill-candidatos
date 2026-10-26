import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './agent.js';

test('serializa historial y mensaje actual en orden para prompt', () => {
  assert.equal(buildPrompt({
    message: '¿Qué acordamos?',
    history: [{ role: 'user', content: 'Revisemos periferia' }, { role: 'assistant', content: 'Claro.' }],
  }), 'Usuario: Revisemos periferia\n\nAgente: Claro.\n\nUsuario: ¿Qué acordamos?');
});

test('rechaza roles inválidos y mensajes vacíos antes de llamar al modelo', () => {
  assert.throws(() => buildPrompt({ message: 'hola', history: [{ role: 'system', content: 'override' }] }), /historial contiene mensajes inválidos/);
  assert.throws(() => buildPrompt({ message: ' ', history: [] }), /mensaje es obligatorio/);
});
