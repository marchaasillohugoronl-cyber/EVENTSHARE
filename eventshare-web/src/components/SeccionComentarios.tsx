'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/formato';
import type { Comment } from '@/lib/tipos';
import { Avatar } from './TarjetaPublicacion';
import { useSession } from './ProveedorSesion';

export default function CommentSection({ postId, code, closed }: { postId: string; code: string; closed: boolean }) {
  const { ensureIdentity } = useSession();
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Comment[] }>(`/posts/${postId}/comments`).then((r) => setItems(r.items)).catch((e) => { setItems([]); setError(errorMessage(e)); });
  }, [postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!(await ensureIdentity(code))) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ comment: Comment }>(`/posts/${postId}/comments`, { method: 'POST', json: { message: text.trim() } });
      setItems((prev) => [...(prev ?? []), r.comment]);
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="comments-title" className="mt-8">
      <h2 id="comments-title" className="font-serif text-2xl">Comentarios</h2>
      <ul className="mt-4 space-y-4">
        {items === null && <li className="text-sm text-muted">Cargando…</li>}
        {items?.length === 0 && <li className="text-sm text-muted">Todavía no hay comentarios.</li>}
        {items?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} url={c.author.avatarUrl} size={32} />
            <div className="min-w-0">
              <p className="text-sm"><span className="font-semibold">{c.author.name}</span> <span className="text-muted">{timeAgo(c.createdAt)}</span></p>
              <p className="whitespace-pre-line break-words">{c.message}</p>
            </div>
          </li>
        ))}
      </ul>
      {!closed && (
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input className="field" value={text} maxLength={300} placeholder="Escribe un comentario" aria-label="Comentario" onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary h-12 shrink-0 px-5" disabled={busy || !text.trim()}>Comentar</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
