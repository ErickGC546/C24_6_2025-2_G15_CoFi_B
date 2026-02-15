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
    <div className="min-h-screen bg-gradient-to-b from-[#f1fff5] via-white to-[#f7fff9] text-[#082214]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 md:px-10">
        <section className="grid gap-8 rounded-3xl bg-white/80 p-6 text-center shadow-[0_30px_80px_rgba(16,185,129,0.18)] backdrop-blur sm:p-8 md:grid-cols-[1.1fr,0.9fr] md:text-left">
          <div className="space-y-6">
            <div className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-emerald-100 px-4 py-1 text-xs font-semibold tracking-[0.25em] text-emerald-600 md:w-auto md:justify-start">
              COFI LIVE
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-500 sm:text-sm">Hola, {userName}</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                Esta es tu cápsula de control financiero. Aquí descubrirás todo lo que COFI hace por ti.
              </h1>
              <p className="text-base text-emerald-900/80">
                Explora las capacidades más poderosas de la app antes de abrirla. Cada módulo fue creado para ayudarte a tomar decisiones rápidas con el soporte de IA.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-700">Descarga inmediata</p>
              <p className="text-xs text-emerald-900/70">Disponible para Android. Próximamente iOS y versión desktop.</p>
              <a
                href="https://github.com/ErickGC546/C24_6_2025-2_G15_CoFi_B/releases/download/CoFi/CoFi.apk"
                download="CoFi.apk"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#082214] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 md:w-auto"
              >
                📱 Descargar COFI para Android
              </a>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-[#0f2a1a] to-[#051309] p-6 text-white">
            <div className="relative h-60 sm:h-64">
              {slides.map((slide, index) => (
                <article
                  key={slide.title}
                  className={`absolute inset-0 flex flex-col justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 transition-opacity duration-500 ${
                    currentSlide === index ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <span className="text-6xl" role="img" aria-label={slide.title}>
                    {slide.icon}
                  </span>
                  <h2 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                    {slide.title}
                  </h2>
                  <p className="text-sm text-emerald-50/80">{slide.description}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={`user-slide-${index}`}
                  type="button"
                  aria-label={`Ir al slide ${index + 1}`}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 w-8 rounded-full transition ${
                    currentSlide === index ? 'bg-emerald-400' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-xs text-emerald-100/80">
              <p className="font-semibold text-white">Lo que verás al abrir la app</p>
              <p>Tablero personalizado, recordatorios proactivos y métricas colaborativas listas para compartir.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {featureHighlights.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_12px_40px_rgba(5,67,34,0.08)]">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-400">
                {feature.badge}
                <span className="h-px flex-1 bg-emerald-100" />
              </div>
              <h3 className="mt-4 text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-emerald-900/80">{feature.description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 rounded-3xl bg-white p-6 sm:p-8 md:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-500 sm:text-sm">Experiencia diaria</p>
            <h2 className="text-2xl font-semibold text-[#082214] sm:text-3xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
              Así te acompaña COFI a lo largo del día.
            </h2>
            <div className="space-y-4">
              {experienceMoments.map((moment) => (
                <article key={moment.label} className="rounded-2xl border border-emerald-100/60 p-4">
                  <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">{moment.label}</p>
                  <h3 className="mt-2 text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                    {moment.title}
                  </h3>
                  <p className="text-sm text-emerald-900/80">{moment.detail}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl bg-emerald-50 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-500 sm:text-sm">Compromiso COFI</p>
            <h3 className="text-xl font-semibold text-[#082214] sm:text-2xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
              Diseñado para protegerte.
            </h3>
            <ul className="space-y-3 text-sm text-emerald-900/80">
              {commitment.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
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
  );
}
