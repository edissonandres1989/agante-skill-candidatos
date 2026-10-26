import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { PromData, type ChatMessage } from '../services/prom.service';

type Candidate = Record<string, string>;
const HISTORY_KEY = 'agente-periferia-history-v1';

function buildChatPrompt(history: ChatMessage[], message: string) {
  const conversation = history.map(({ role, content }) =>
    `${role === 'user' ? 'Usuario' : 'Agente'}: ${content}`,
  );
  conversation.push(`Usuario: ${message}`);
  return conversation.join('\n\n');
}

function linkedinSearch(candidate: Candidate) {
  const role = candidate.cargo ?? candidate.perfil ?? candidate.titulo ?? '';
  const skills = candidate.habilidades ?? candidate.skills ?? '';
  const sector = candidate.sector ?? candidate.industria ?? '';
  const keywords = ['cliente', role, skills, sector].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export const Generate = () => {
  const [history, setHistory] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as ChatMessage[]; }
    catch { return []; }
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const retryContent = useRef(false);

  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);

  const processExcel = async (file?: File) => {
    setFileError(''); setCandidates([]);
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) { setFileError('Selecciona un archivo .xlsx o .xls.'); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Candidate>(sheet, { defval: '' });
      if (!rows.length) { setFileError('El Excel no contiene filas de candidatos.'); return; }
      const normalized = rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()]),
      ));
      const valid = normalized.filter((row) => (row.nombre || row.name)
        && (row.cargo || row.perfil || row.titulo || row.habilidades || row.skills || row.sector || row.industria));
      if (!valid.length) { setFileError('No encontré candidatos con nombre y al menos un dato de cargo, habilidades o sector.'); return; }
      if (valid.length < normalized.length) setFileError(`${normalized.length - valid.length} filas omitidas: requieren nombre y cargo, habilidades o sector.`);
      setCandidates(valid);
      console.log('[Excel_periferia] Candidatos validados:', valid);
    } catch {
      setFileError('No se pudo leer el Excel. Verifica que el archivo no esté dañado.');
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setError(''); setMessage('');
    const isRetry = retryContent.current && history.at(-1)?.role === 'user' && history.at(-1)?.content === text;
    retryContent.current = false;
    const nextHistory = isRetry ? history : [...history, { role: 'user' as const, content: text }];
    setHistory(nextHistory);
    if (/^excel_periferia\b/i.test(text)) {
      setHistory([...nextHistory, { role: 'assistant', content: 'Adjunta el Excel (.xlsx o .xls). Validaré los candidatos y mostraré sus datos en la consola del navegador.' }]);
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const context = isRetry ? history.slice(0, -1) : history;
      const answer = await PromData({ message: buildChatPrompt(context, text) });
      setHistory([...nextHistory, { role: 'assistant', content: answer }]);
    } catch (cause) {
      const detail = cause instanceof Error && cause.message === 'Failed to fetch'
        ? 'No hay conexión con el servidor. Tu mensaje se conserva; intenta enviarlo de nuevo.'
        : cause instanceof Error ? cause.message : 'Error inesperado.';
      setError(detail);
    } finally { setBusy(false); }
  };

  const retry = () => { const last = history.at(-1); if (last?.role === 'user') { retryContent.current = true; setMessage(last.content); } };

  return <div className="flex min-h-screen flex-col bg-[#212121] text-white">
    <header className="border-b border-white/10 p-4"><h1 className="text-lg font-semibold">Agente Periferia</h1></header>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
      <h2 className="text-center text-3xl font-semibold">¿En qué puedo ayudarte?</h2>
      <section aria-live="polite" className="flex flex-1 flex-col gap-3">
        {history.map((turn, index) => <p key={`${index}-${turn.role}`} className={`max-w-2xl whitespace-pre-wrap rounded-2xl p-4 ${turn.role === 'user' ? 'self-end bg-[#303030]' : 'self-start bg-[#252525]'}`}>
          <strong>{turn.role === 'user' ? 'Tú' : 'Agente'}: </strong>{turn.content}
        </p>)}
      </section>
      <form onSubmit={send} className="flex w-full items-center gap-3 rounded-3xl bg-[#303030] p-3">
        <input aria-label="Mensaje" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe un mensaje o Excel_periferia..." className="flex-1 bg-transparent p-2 outline-none placeholder:text-gray-400" />
        <button disabled={busy || !message.trim()} className="rounded-full bg-white px-4 py-2 text-black disabled:opacity-50">{busy ? '…' : 'Enviar'}</button>
      </form>
      {error && <div role="alert" className="text-red-300">{error} <button onClick={retry} className="underline">Reintentar</button></div>}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void processExcel(event.target.files?.[0])} />
      {fileError && <p role="alert" className="text-red-300">{fileError}</p>}
      {candidates.length > 0 && <section className="rounded-2xl bg-[#303030] p-4">
        <h3 className="mb-2 font-semibold">{candidates.length} candidatos validados</h3>
        <p className="mb-3 text-sm text-gray-300">Los datos también están en la consola del navegador. Abre LinkedIn para revisar coincidencias manualmente.</p>
        <ul className="space-y-2">{candidates.map((candidate, index) => <li key={index} className="flex items-center justify-between gap-3">
          <span>{candidate.nombre ?? candidate.name} {candidate.cargo || candidate.perfil ? `— ${candidate.cargo ?? candidate.perfil}` : ''}</span>
          <a className="shrink-0 text-blue-300 underline" href={linkedinSearch(candidate)} target="_blank" rel="noreferrer">Buscar en LinkedIn</a>
        </li>)}</ul>
      </section>}
      {busy && <p className="text-sm text-gray-400">Generando respuesta...</p>}
    </main>
  </div>;
};
