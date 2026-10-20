import FormularioEventoWeb from '@/components/admin/FormularioEventoWeb';
export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  return <FormularioEventoWeb id={(await params).id} />;
}
