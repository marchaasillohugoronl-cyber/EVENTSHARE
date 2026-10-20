import Link from 'next/link';
import { ArrowUpRight, Camera, Layers3, QrCode } from 'lucide-react';
import LandingForm from '@/components/FormularioInicio';
import RobotSenati from '@/components/RobotSenati';
import MarcaSenati from '@/components/MarcaSenati';

export default function Home() {
  return <main className="senati-home">
    <div className="home-utility"><div><span className="utility-active">Comunidad SENATI</span><span>Talento e innovación</span><span className="utility-project">EventShare · Proyecto de concurso</span></div></div>
    <div className="home-header"><nav className="home-nav" aria-label="Navegación principal">
      <Link href="/" className="home-brand" aria-label="SENATI · EventShare, inicio"><MarcaSenati /></Link>
      <div className="home-nav-links"><a href="#participar">Participa</a><a href="#como-funciona">Cómo funciona</a><a href="#ayuda">Ayuda</a><Link href="/crear" className="home-admin">Crea tu evento aquí <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    </nav><nav className="home-mobile-nav" aria-label="Secciones"><a href="#participar">Participa</a><a href="#como-funciona">Cómo funciona</a><a href="#ayuda">Ayuda</a></nav></div>
    <section className="home-hero">
      <div className="home-copy">
        <p className="home-eyebrow"><span /> EVENTSHARE · COMUNIDAD SENATI</p>
        <div className="home-campaign"><p>EL TALENTO NOS CONECTA</p><h1>VIVE EL MOMENTO.<br /><span>COMPÁRTELO<br />CON TODOS.</span></h1></div>
        <p className="home-description">Las mejores ideas nos unen. Los mejores momentos se quedan. Comparte fotos, videos y recuerdos de tu evento en un solo lugar.</p>
        <div className="home-access" id="participar"><div className="access-heading"><QrCode size={20} aria-hidden="true" /><h2>Tu evento empieza aquí</h2></div><p>Ingresa tu código o escanea el QR del evento.</p><LandingForm /></div>
        <p className="home-footnote">Desde tu celular. Sin instalar una app.</p>
      </div>
      <div className="home-visual"><div className="visual-topline"><span>COMUNIDAD SENATI</span><span>CREANDO EL FUTURO ↗</span></div><RobotSenati /><div className="visual-bottomline"><span>TECNOLOGÍA CON<br /><strong>UN LADO HUMANO.</strong></span><span className="visual-coordinate">01 / CONECTAR</span></div></div>
    </section>
    <section className="home-community" id="como-funciona"><h2>LOS MEJORES MOMENTOS SE VIVEN EN COMUNIDAD</h2><p>Tu talento, tus experiencias y tus recuerdos tienen un lugar aquí.</p></section>
    <section className="home-steps" aria-label="Cómo participar">{[{ icon: QrCode, title: 'Escanea y entra', text: 'Un código te conecta con tu evento.' }, { icon: Camera, title: 'Captura el momento', text: 'Sube esa foto, video o mensaje especial.' }, { icon: Layers3, title: 'Revívelo en comunidad', text: 'Todos los recuerdos, en un mismo álbum.' }].map(({ icon: Icon, title, text }, index) => <article key={title}><span className="step-number">0{index + 1}</span><Icon size={23} strokeWidth={1.5} aria-hidden="true" /><div><h2>{title}</h2><p>{text}</p></div></article>)}</section>
    <section className="home-invitation"><div><p className="home-eyebrow">EXPERIENCIAS QUE NOS UNEN</p><h2>Tu próximo evento.<br /><span>Un recuerdo de todos.</span></h2><p>Reúne las fotos y los mensajes de tu comunidad en un álbum compartido. Tú creas el evento; cada invitado aporta su historia.</p><Link href="/crear" className="btn btn-primary">Quiero crear mi evento <ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="home-benefits"><article><Camera aria-hidden="true" /><h3>Fotos, videos y mensajes</h3><p>Distintas formas de contar lo que vivimos juntos.</p></article><article><QrCode aria-hidden="true" /><h3>Un QR para conectar</h3><p>Comparte el acceso con los invitados de tu evento.</p></article><article><Layers3 aria-hidden="true" /><h3>Un álbum compartido</h3><p>Encuentra los momentos del evento en un solo lugar.</p></article></div></section>
    <section className="home-help" id="ayuda"><div><p className="home-eyebrow">ESTAMOS PARA ORIENTARTE</p><h2>¿Listo para participar?</h2><p>Todo lo que necesitas para empezar.</p></div><div className="home-faq"><details><summary>¿Dónde encuentro el código de mi evento?</summary><p>El organizador te comparte un código o un QR. Escribe el código en «Tu evento empieza aquí» o abre la cámara desde el botón para escanearlo.</p></details><details><summary>¿Necesito instalar una aplicación?</summary><p>No. Puedes entrar al evento desde el navegador de tu celular o computadora y seguir los pasos para participar.</p></details><details><summary>¿Por qué mi foto todavía no aparece?</summary><p>Si el evento tiene moderación activada, el organizador debe aprobar tu publicación antes de que aparezca en el muro.</p></details></div></section>
    <footer className="home-footer"><div><MarcaSenati /><p>EventShare · Proyecto de concurso.<br />Tecnología para compartir lo que nos une.</p></div><nav aria-label="Enlaces del pie de página"><a href="#participar">Entrar a un evento</a><Link href="/crear">Crear un evento</Link><a href="#ayuda">Preguntas frecuentes</a></nav><span>Talento que transforma.<br />Comunidad que conecta.</span></footer>
  </main>;
}
