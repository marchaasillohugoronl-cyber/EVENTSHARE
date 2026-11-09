import { redirect } from 'next/navigation';

// Conserva los enlaces antiguos: ahora se comparte desde el propio evento.
export default async function UploadPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/e/${encodeURIComponent(code)}`);
}
