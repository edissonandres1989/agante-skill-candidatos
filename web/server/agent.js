export function buildPrompt({ message, history }) {
  if (typeof message !== 'string' || !message.trim()) throw new Error('El mensaje es obligatorio.');
  if (!Array.isArray(history) || history.length > 40) throw new Error('Historial inválido o demasiado largo.');
  const conversation = history.map(({ role, content }) => {
    if (!['user', 'assistant'].includes(role) || typeof content !== 'string') {
      throw new Error('El historial contiene mensajes inválidos.');
    }
    const label = role === 'user' ? 'Usuario' : 'Agente';
    return `${label}: ${content.slice(0, 8000)}`;
  });
  conversation.push(`Usuario: ${message.trim().slice(0, 8000)}`);
  return conversation.join('\n\n');
}
