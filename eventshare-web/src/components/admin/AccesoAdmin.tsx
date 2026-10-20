'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { esAdministrador } from '@/lib/permisos';
import { codigoOrigen, destinoAdmin } from '@/lib/rutasAdmin';
import type { User } from '@/lib/tipos';
import { useSession } from '@/components/ProveedorSesion';

export default function AccesoAdmin() {
  const { user, ready, setSession } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const from = codigoOrigen(params.get('from'));
  const next = destinoAdmin(params.get('next'));
  const [clientId, setClientId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attempt, setAttempt] = useState(0);
  const googleRef = useRef<HTMLDivElement>(null);
  const done = useCallback((account: User) => {
    setSession(account);
    router.replace(`${next}${from ? `?from=${from}` : ''}`);
  }, [setSession, router, next, from]);

  useEffect(() => {
    if (ready && user && esAdministrador(user.role)) done(user);
  }, [ready, user, done]);
  useEffect(() => {
    let active = true;
    setError('');
    api<{ clientId: string | null }>('/auth/google/config').then(r => {
      if (!active) return;
      setClientId(r.clientId);
      if (!r.clientId) setError('El registro con Google todavía no está disponible. Inténtalo más tarde.');
    }).catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!clientId || !scriptReady || !googleRef.current || !window.google) return;
    let active = true;
    window.google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }: { credential: string }) => {
      if (!active) return;
      setBusy(true); setError('');
      try {
        const r = await api<{ user: User }>('/auth/google/web', { method: 'POST', json: { idToken: credential } });
        if (active) done(r.user);
      } catch (e) { if (active) { setError(errorMessage(e)); setBusy(false); } }
    } });
    window.google.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
    return () => { active = false; };
  }, [clientId, scriptReady, done]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setLoginError('');
    try { done((await api<{ user: User }>('/auth/login/web', { method: 'POST', json: { email, password } })).user); }
    catch (err) { setLoginError(errorMessage(err)); setBusy(false); }
  }
  if (!ready || (user && esAdministrador(user.role))) return <p role="status" className="p-12 text-center">Preparando tu espacio…</p>;
  return (
    <main className="creator-welcome mx-auto max-w-5xl px-5 py-10 sm:py-20">
      <Link href={from ? `/e/${from}` : '/'} className="text-sm text-muted">← {from ? 'Volver al evento' : 'EventShare'}</Link>
      <div className="mt-10 grid gap-10 md:grid-cols-2 md:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-muted">Ahora te toca ser anfitrión</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Tus eventos.<br />Sus mejores recuerdos.</h1>
          <p className="mt-5 max-w-md text-lg text-muted">Crea tu evento, comparte el QR y reúne las fotos y videos de todos en un mismo lugar.</p>
          <ol className="mt-8 space-y-4 text-sm"><li>01 · Entra con tu cuenta de Google.</li><li>02 · Ponle nombre a tu evento.</li><li>03 · Comparte tu QR y empieza a recibir recuerdos.</li></ol>
        </div>
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8" aria-labelledby="access-title">
          <h2 id="access-title" className="font-serif text-2xl">Crea tu propio evento</h2>
          <p className="mb-7 mt-2 text-sm text-muted">Todo desde aquí, sin instalar una aplicación.</p>
          {clientId && <Script src="https://accounts.google.com/gsi/client" onReady={() => setScriptReady(true)} onError={() => setError('No se pudo cargar Google. Revisa tu conexión y recarga la página.')} />}
          <div className={`flex min-h-12 justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} ref={googleRef} />
          {busy && <p role="status" className="mt-3 text-center text-sm">Entrando a tu espacio…</p>}
          {error && <div role="alert" className="mt-4 text-sm text-red-700"><p>{error}</p><button type="button" className="mt-2 underline" onClick={() => setAttempt(v => v + 1)} disabled={busy}>Reintentar</button></div>}
          <p className="mt-6 text-center text-xs text-muted">Tu cuenta te permite crear y administrar tus propios eventos.</p>
          <details className="mt-8 border-t border-line pt-5"><summary className="cursor-pointer text-sm">Ya tengo cuenta con contraseña</summary>
            <form onSubmit={login} className="mt-4 space-y-3">
              <label className="block text-sm">Correo<input className="field mt-1" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
              <label className="block text-sm">Contraseña<input className="field mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
              {loginError && <p role="alert" className="text-sm text-red-700">{loginError}</p>}
              <button className="btn btn-primary w-full" disabled={busy}>Entrar</button>
            </form>
          </details>
        </section>
      </div>
    </main>
  );
}
