/** Geometría del emblema SENATI, compartida entre la cabecera y el robot. */
export const trazadoSenati = 'M24.2 0H71.2L81.5 17.2H31.8L21.8 33.3L31.8 50.1H56.3L57.4 48.1L55.6 45.2H34.4L27.8 33.3L34.4 22H84.6L95.4 39.7L71 79H24L13.6 62.2H63.2L73.3 45.3L63.3 28.1H38.5L37.4 30.4L39.2 33.3H60.5L67.2 45.2L60.5 57.4H10.6L0 39.7Z';

export default function MarcaSenati() {
  return <span className="marca-senati"><svg viewBox="0 0 95.4 79" aria-hidden="true"><path d={trazadoSenati} fill="currentColor" /></svg><span>SENATI</span></span>;
}
