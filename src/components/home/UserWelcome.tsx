'use client';

import { useEffect, useRef, useState } from 'react';

const AUTO_CAROUSEL_INTERVAL = 3500;

const slides = [
  {
    title: 'Registra gastos con tu voz',
    description: "Di 'menos 40 soles en almuerzo' y COFI lo registra al instante.",
    icon: '🎤'
  },
  {
    title: 'Gestiona finanzas en grupo',
    description: 'Comparte presupuestos, divide gastos y evita cálculos manuales.',
    icon: '👥'
  },
  {
    title: 'Cumple tus metas de ahorro',
    description: 'Visualiza el progreso y activa recordatorios inteligentes.',
    icon: '🎯'
  }
];

const featureHighlights = [
  {
    title: 'Registrar gastos',
    description: 'Dicta, toma una foto del recibo o escribe. COFI limpia los datos y clasifica en segundos.',
    badge: 'Modo voz'
  },
  {
    title: 'Metas de ahorro',
    description: 'Define objetivos, automatiza transferencias y sigue el progreso con alertas inteligentes.',
    badge: 'Focus semanal'
  },
  {
    title: 'Grupos colaborativos',
    description: 'Coordina presupuestos, divide gastos y comparte reportes en tiempo real con tu equipo.',
    badge: 'Workrooms'
  },
  {
    title: 'IA copiloto',
    description: 'Recibe recomendaciones accionables, predicciones de cashflow y mensajes preventivos.',
    badge: 'Smart coach'
  }
];

const experienceMoments = [
  {
    label: 'Mañana',
    title: 'Reportes diarios en tu bandeja',
    detail: 'Resumen inteligente a las 7:00 am con gastos, metas y recordatorios para tu grupo.'
  },
  {
    label: 'En movimiento',
    title: 'Modo voz manos libres',
    detail: 'Solo di “menos 15 en café” y queda registrado con ubicación y categoría automática.'
  },
  {
    label: 'Noche',
    title: 'Alertas de IA',
    detail: 'La app detecta patrones inusuales y te sugiere acciones antes de que sea tarde.'
  }
];

const commitment = [
  'Datos cifrados y respaldados en Firebase.',
  'Sin anuncios, sin venta de información.',
  'Actualizaciones semanales basadas en feedback de la comunidad.'
];

interface UserWelcomeProps {
  userName: string;
}

export default function UserWelcome({ userName }: UserWelcomeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
    }, AUTO_CAROUSEL_INTERVAL);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide]);

  return (
    <div className="min-h-screen bg-[#030c06] pb-16 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(34,197,94,0.25), transparent 45%), radial-gradient(circle at 80% 20%, rgba(12,92,60,0.4), transparent 50%)'
        }}
      />

      <div className="relative z-10 w-full px-4 py-10 sm:px-6 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:gap-16">
          <section className="grid gap-10 rounded-3xl bg-[#08150f]/70 p-8 text-center backdrop-blur-lg sm:p-10 md:grid-cols-2 md:text-left">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center justify-center rounded-full border border-emerald-600/40 bg-emerald-600/10 px-4 py-1 text-xs font-semibold tracking-[0.35em] text-emerald-300">
                COFI LIVE
              </span>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">Hola, {userName}</p>
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                  Tu app está lista. Explora aquí lo que te espera cuando la abras.
                </h1>
                <p className="text-base text-emerald-100/80">
                  Carruseles inteligentes, recordatorios preventivos y un copiloto de IA que traduce tus hábitos financieros en decisiones claras.
                </p>
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-left">
                <p className="text-sm font-semibold text-emerald-200">Descarga inmediata</p>
                <p className="text-xs text-emerald-100/70">Disponible para Android. Próximamente iOS y desktop.</p>
                <a
                  href="https://github.com/ErickGC546/C24_6_2025-2_G15_CoFi_B/releases/download/CoFi/CoFi.apk"
                  download="CoFi.apk"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-[#030c06] shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 sm:w-auto"
                >
                  📱 Descargar COFI para Android
                </a>
              </div>
            </div>

            <div className="rounded-3xl bg-[#0e1d16] p-6 shadow-[0_20px_60px_rgba(15,118,110,.25)] sm:p-8">
              <div className="relative h-64 sm:h-72">
                {slides.map((slide, index) => (
                  <article
                    key={slide.title}
                    className={`absolute inset-0 flex flex-col justify-center rounded-2xl bg-gradient-to-br from-[#12261b] to-[#0c140f] p-8 transition-opacity duration-500 ${
                      currentSlide === index ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <span className="text-6xl" role="img" aria-label={slide.title}>
                      {slide.icon}
                    </span>
                    <h2 className="mt-6 text-2xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                      {slide.title}
                    </h2>
                    <p className="mt-2 text-base text-emerald-100/80">{slide.description}</p>
                  </article>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-2">
                {slides.map((_, index) => (
                  <button
                    key={`user-slide-${index}`}
                    type="button"
                    aria-label={`Ir al slide ${index + 1}`}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 w-8 rounded-full transition ${
                      currentSlide === index ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-emerald-50/80">
                <p className="font-semibold text-white">Lo que verás al abrir la app</p>
                <p>Panel personal, comandos rápidos por voz y IA que te avisa antes de que un gasto se dispare.</p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            {featureHighlights.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-400">
                  {feature.badge}
                  <span className="h-px flex-1 bg-white/20" />
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-emerald-100/80">{feature.description}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-8 rounded-3xl bg-[#050f08] p-8 shadow-inner shadow-black/30 md:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Experiencia diaria</p>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                Así te acompaña COFI a lo largo del día.
              </h2>
              <div className="space-y-4">
                {experienceMoments.map((moment) => (
                  <article key={moment.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">{moment.label}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                      {moment.title}
                    </h3>
                    <p className="text-sm text-emerald-100/80">{moment.detail}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6 text-emerald-100">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Compromiso COFI</p>
              <h3 className="text-2xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                Diseñado para protegerte.
              </h3>
              <ul className="space-y-3 text-sm text-emerald-50/80">
                {commitment.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-center border-t border-white/10 pt-6 text-center text-sm text-emerald-100/70">
            <span className="w-full">© {new Date().getFullYear()} COFI · Diseñado por ErickGC546</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
