import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { PromData, type ChatMessage } from '../services/prom.service';

type Candidate = Record<string, string>;
const HISTORY_KEY = 'agente-periferia-history-v1';
const REQUIRED_EXCEL_FIELDS = ['nombre', 'cargo', 'habilidades', 'industria'] as const;

function buildChatPrompt(history: ChatMessage[], message: string) {
  const conversation = history.map(({ role, content }) =>
    `${role === 'user' ? 'Usuario' : 'Agente'}: ${content}`,
  );
  conversation.push(`Usuario: ${message}`);
  return conversation.join('\n\n');
}

function linkedinSearch(candidate: Candidate) {
  const role = candidate.cargo ?? '';
  const skills = candidate.habilidades ?? '';
  const keywords = [role, skills].filter(Boolean).join(',');
  return `https://www.linkedin.com/jobs/search-results/?keywords=${encodeURIComponent(keywords)}&origin=JOBS_HOME_SEARCH_BUTTON`;
}

function periferiaJobSearch(candidate: Candidate) {
  return `https://jobs.periferiaitgroup.com/jobs?query=${encodeURIComponent(candidate.habilidades ?? '')}`;
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
      const [headers = []] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
      const fields = headers
        .map((header) => String(header).trim().toLowerCase())
        .filter(Boolean);
      const missingFields = REQUIRED_EXCEL_FIELDS.filter((field) => !fields.includes(field));
      const extraFields = fields.filter((field) => !REQUIRED_EXCEL_FIELDS.includes(field as typeof REQUIRED_EXCEL_FIELDS[number]));

      if (missingFields.length || extraFields.length) {
        const details = [
          missingFields.length && `Campos faltantes: ${missingFields.join(', ')}.`,
          extraFields.length && `Campos sobrantes: ${extraFields.join(', ')}.`,
        ].filter(Boolean).join(' ');
        setFileError(`El Excel debe contener únicamente las columnas: ${REQUIRED_EXCEL_FIELDS.join(', ')}. ${details}`);
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Candidate>(sheet, { defval: '' });
      if (!rows.length) { setFileError('El Excel no contiene filas de candidatos.'); return; }
      const normalized = rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()]),
      ));
      const valid = normalized.filter((row) => REQUIRED_EXCEL_FIELDS.every((field) => row[field]));
      if (!valid.length) { setFileError('No encontré candidatos con todos los campos requeridos: nombre, cargo, habilidades e industria.'); return; }
      if (valid.length < normalized.length) setFileError(`${normalized.length - valid.length} filas omitidas: deben completar nombre, cargo, habilidades e industria.`);
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
        <p className="mb-3 text-sm text-gray-300">Los datos también están en la consola del navegador. Consulta las vacantes relacionadas en LinkedIn o Periferia.</p>
        <ul className="space-y-2">{candidates.map((candidate, index) => <li key={index} className="flex items-center justify-between gap-3">
          <span>{candidate.nombre ?? candidate.name} {candidate.cargo || candidate.perfil ? `— ${candidate.cargo ?? candidate.perfil}` : ''}</span>
          <div className="flex shrink-0 gap-3">
            <a className="text-blue-300 underline" href={linkedinSearch(candidate)} target="_blank" rel="noreferrer">Buscar empleos en LinkedIn</a>
            <a className="text-blue-300 underline" href={periferiaJobSearch(candidate)} target="_blank" rel="noreferrer">Vacante Periferia</a>
          </div>
        </li>)}</ul>
      </section>}
      {busy && <p className="text-sm text-gray-400">Generando respuesta...</p>}
    </main>
  </div>;
};
