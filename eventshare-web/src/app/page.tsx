import LandingForm from '@/components/FormularioInicio';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-5xl leading-[1.05] sm:text-6xl">Todas las fotos de la fiesta, en un solo lugar.</h1>
      <p className="mt-6 max-w-md text-lg text-muted">Escanea el código QR de tu evento, o escribe el código que te dieron los anfitriones.</p>
      <LandingForm />
    </main>
  );
}
