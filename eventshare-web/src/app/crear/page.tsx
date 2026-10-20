import { Suspense } from 'react';
import AccesoAdmin from '@/components/admin/AccesoAdmin';
export const metadata = { title: 'Crea tus propios eventos' };
export default function CrearPage() {
  return <Suspense fallback={<p className="p-12" role="status">Cargando…</p>}><AccesoAdmin /></Suspense>;
}
