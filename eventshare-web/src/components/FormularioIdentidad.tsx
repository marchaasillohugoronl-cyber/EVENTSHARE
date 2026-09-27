'use client';

import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/tipos';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window { google?: any }
}

export default function IdentityForm({ eventCode, onDone }: { eventCode: string; onDone: (u: User) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setName(localStorage.getItem('es_name') ?? ''); } catch { /* almacenamiento no disponible */ }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }: { credential: string }) => {
          setBusy(true);
          setError(null);
          try {
            const { user } = await api<{ user: User }>('/auth/google', { method: 'POST', json: { idToken: credential, eventCode } });
            onDone(user);
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
    };
    if (window.google) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [eventCode, onDone]);

  async function continueAsGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Escribe tu nombre para continuar.');
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>('/auth/guest', { method: 'POST', json: { name: name.trim(), eventCode } });
      try { localStorage.setItem('es_name', name.trim()); } catch { /* ignorar */ }
      onDone(user);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {GOOGLE_CLIENT_ID && (
        <>
          <div className="flex justify-center"><div ref={googleRef} /></div>
          <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" /></div>
        </>
      )}
      <form onSubmit={continueAsGuest} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="guest-name">Tu nombre</label>
        <input id="guest-name" className="field" value={name} maxLength={40} autoComplete="given-name"
          placeholder="Por ejemplo, Carlos" onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Entrando…' : 'Continuar como invitado'}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
