export function codigoOrigen(value: string | null): string | null {
  return value && /^[a-z0-9]{6,12}$/i.test(value) ? value.toUpperCase() : null;
}
export function destinoAdmin(value: string | null): string {
  return value && /^\/admin(?:\/nuevo|\/eventos\/[a-f0-9-]{36}(?:\/editar)?)?$/.test(value) ? value : '/admin/nuevo';
}


