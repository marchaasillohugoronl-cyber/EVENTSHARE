'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import IdentityForm from '@/components/FormularioIdentidad';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = (sp.get('event') ?? '').toUpperCase();
  const next = sp.get('next');
  const safeNext = next && next.startsWith('/e/') ? next : `/e/${code}`;

  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    return (
      <>
        <h1 className="font-serif text-4xl">Escanea el QR del evento</h1>
        <p className="mt-3 text-muted">Para participar necesitas entrar desde el código QR o el enlace del evento.</p>
        <Link href="/" className="btn btn-primary mt-8">Escribir el código</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-serif text-4xl">¿Quién eres?</h1>
      <p className="mb-8 mt-2 text-muted">Así los demás sabrán quién compartió cada foto.</p>
      <IdentityForm eventCode={code} onDone={() => router.replace(safeNext)} />
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto min-h-screen max-w-sm px-6 py-16">
      <Suspense fallback={null}><LoginInner /></Suspense>
    </main>
  );
}
