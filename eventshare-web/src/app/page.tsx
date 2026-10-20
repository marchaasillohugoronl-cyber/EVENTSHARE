import Link from 'next/link';
import LandingForm from '@/components/FormularioInicio';

export default function Home() {
  return (
    <main className="intro mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-8 flex items-center gap-3 text-lg font-semibold"><span aria-hidden="true" className="h-6 w-1 rounded-full bg-brand" />EventShare</p>
      <h1 className="font-serif text-4xl leading-[1.12] sm:text-5xl">Todas las fotos de la fiesta, en un solo lugar.</h1>
      <p className="mt-6 max-w-md text-lg text-muted">Escanea el código QR de tu evento, o escribe el código que te dieron los anfitriones.</p>
      <LandingForm />
      <Link href="/crear" className="mt-8 text-center text-sm underline underline-offset-4">Crear mis propios eventos ↗</Link>
    </main>
  );
}
