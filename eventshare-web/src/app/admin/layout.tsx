import { Suspense } from 'react';
import MarcoAdmin from '@/components/admin/MarcoAdmin';
export const metadata = { title: 'Mis eventos', robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-12" role="status">Cargando…</p>}><MarcoAdmin>{children}</MarcoAdmin></Suspense>;
}
