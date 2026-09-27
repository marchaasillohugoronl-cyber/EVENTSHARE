import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl">No encontramos ese evento</h1>
      <p className="mt-3 text-muted">Revisa el código o vuelve a escanear el QR.</p>
      <Link href="/" className="btn btn-primary mt-8 self-start">Ir al inicio</Link>
    </main>
  );
}
