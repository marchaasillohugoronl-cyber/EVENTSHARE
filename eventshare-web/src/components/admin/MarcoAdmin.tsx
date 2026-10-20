'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/ProveedorSesion';
import { esAdministrador } from '@/lib/permisos';
import { codigoOrigen, destinoAdmin } from '@/lib/rutasAdmin';
import { api, errorMessage } from '@/lib/api';

export default function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const { user, ready, setSession } = useSession();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const from = codigoOrigen(params.get('from'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy && ready && (!user || !esAdministrador(user.role))) router.replace(`/crear?next=${encodeURIComponent(destinoAdmin(path))}${from ? `&from=${from}` : ''}`);
  }, [ready, user, router, path, from, busy]);
  async function logout() {
    setBusy(true); setError('');
    try { await api('/auth/logout', { method: 'POST', json: {} }); setSession(null); router.replace(from ? `/e/${from}` : '/'); }
    catch (e) { setError(errorMessage(e)); setBusy(false); }
  }
  if (!ready || !user || !esAdministrador(user.role)) return <p role="status" className="p-12 text-center">Preparando tu espacio…</p>;
  return <div className="min-h-screen bg-paper">
    <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
      <Link href="/admin" className="text-lg font-semibold">EventShare <span className="ml-2 text-xs font-normal text-muted">Mi espacio</span></Link>
      <div className="flex items-center gap-4"><span className="max-w-40 truncate text-sm">{user.name}</span><button onClick={logout} disabled={busy} className="text-sm underline">{busy ? 'Saliendo…' : 'Salir'}</button></div>
    </div></header>
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
      <nav aria-label="Administración" className="mb-8 flex flex-wrap items-center gap-5 text-sm"><Link href="/admin" aria-current={path === '/admin' ? 'page' : undefined} className="font-semibold">Mis eventos</Link><Link href="/admin/nuevo">Crear evento</Link>{from && <Link className="ml-auto text-muted" href={`/e/${from}`}>← Volver al evento que estabas viendo</Link>}</nav>
      {user.role === 'SUPER_ADMIN' && <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted">Superadministrador</p>}
      {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
      {children}
    </main>
  </div>;
}
