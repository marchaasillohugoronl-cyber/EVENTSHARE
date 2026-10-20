import PanelEvento from '@/components/admin/PanelEvento';
export default async function EventoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  return <PanelEvento id={(await params).id} />;
}
