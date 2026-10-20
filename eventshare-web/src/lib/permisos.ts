export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'GUEST';
export type EventTheme = 'STANDARD' | 'SENATI_TEC';
export const esAdministrador = (role: Role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
export const puedeUsarTema = (role: Role, theme: EventTheme) => esAdministrador(role) && (theme === 'STANDARD' || role === 'SUPER_ADMIN');
