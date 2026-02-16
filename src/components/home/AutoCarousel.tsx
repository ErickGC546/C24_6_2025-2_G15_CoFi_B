'use client';

import { useEffect, useRef, useState } from 'react';

const AUTO_CAROUSEL_INTERVAL = 3500;

const slides = [
  {
    title: 'Registra gastos con tu voz',
    description: "Tan simple como decir 'menos 40 soles en McDonald's' para registrar tus gastos al instante.",
    icon: '🎤'
  },
  {
    title: 'Gestiona finanzas en grupo',
    description: 'Comparte gastos y maneja el presupuesto con tu grupo de amigos o compañeros de clase.',
    icon: '👥'
  },
  {
    title: 'Cumple tus metas de ahorro',
    description: 'Define objetivos financieros y visualiza tu progreso hasta alcanzarlos.',
    icon: '🎯'
  }
];

const metrics = [
  { label: 'Usuarios activos', value: '+4,500' },
  { label: 'Grupos creados', value: '820' },
  { label: 'Metas logradas', value: '1,200' }
];

const howItWorks = [
  {
    title: 'Conecta tu cuenta',
    description: 'Regístrate con Google, configura tus preferencias y empieza a registrar gastos en segundos.'
  },
  {
    title: 'Habla o toca',
    description: 'Usa comandos de voz o el panel táctil para registrar gastos, dividirlos y asignarlos a metas.'
  },
  {
    title: 'Visualiza y actúa',
    description: 'Panel inteligente con alertas automáticas, recomendaciones de IA y reportes listos para compartir.'
  }
];

const benefits = [
  {
    title: 'IA que te acompaña',
    description: 'Recibe consejos personalizados según tus hábitos y pronósticos de cashflow.'
  },
  {
    title: 'Modo colaborativo',
    description: 'Presupuestos compartidos, recordatorios y liquidaciones automáticas para grupos.'
  },
  {
    title: 'Seguridad al usuario',
    description: 'Cifrado y respaldo en Firebase para mantener tus datos protegidos.'
  }
];

const testimonial = {
  quote:
    '“COFI nos ayudó a ordenar el presupuesto del viaje en minutos. Registrar cada gasto por voz es la mejor parte.”',
  author: 'Luna Chávez — Líder de viajes universitarios'
};

export default function AutoCarousel() {
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
            'radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 40%), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 35%)'
        }}
      />

      <div className="relative z-10 w-full px-4 py-10 sm:px-6 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:gap-16">
          <section className="grid gap-10 rounded-3xl bg-[#08150f]/70 p-8 text-center backdrop-blur-lg sm:p-10 md:grid-cols-2 md:text-left">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center justify-center rounded-full border border-emerald-600/40 bg-emerald-600/10 px-4 py-1 text-sm font-semibold tracking-[0.2em] text-emerald-300">
                COFI
              </span>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                  Finanzas conscientes para equipos, parejas y proyectos.
                </h1>
                <p className="text-lg text-emerald-100/80">
                  Simplifica el control de gastos, comparte presupuestos y recibe recomendaciones accionables impulsadas por IA. Una app, todas tus decisiones financieras claras.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-4 md:justify-start">
                <a
                  href="/login"
                  className="rounded-xl border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:border-emerald-400 hover:text-emerald-200"
                >
                  Ver cómo funciona
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-emerald-100/70 md:justify-start">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐️⭐️⭐️⭐️⭐️</span>
                  <span>en Android</span>
                </div>
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
                    key={`dot-${index}`}
                    type="button"
                    aria-label={`Ir al slide ${index + 1}`}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 w-8 rounded-full transition ${
                      currentSlide === index ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <p className="text-3xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                  {metric.value}
                </p>
                <p className="mt-2 text-sm uppercase tracking-widest text-emerald-100/70">{metric.label}</p>
              </div>
            ))}
          </section>

          <section id="tour" className="grid gap-6 rounded-3xl bg-[#050f08] p-8 shadow-inner shadow-black/40 sm:grid-cols-2 sm:p-10 md:grid-cols-3">
            {howItWorks.map((step, index) => (
              <div key={step.title} className="space-y-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-semibold text-emerald-400">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-emerald-100/80">{step.description}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-2xl border border-white/5 bg-white/5 p-6">
                <h4 className="text-lg font-semibold text-white">{benefit.title}</h4>
                <p className="mt-3 text-sm text-emerald-100/80">{benefit.description}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-8 rounded-3xl border border-white/5 bg-gradient-to-br from-[#102619] to-[#060f0a] p-8 md:grid-cols-[1.1fr,0.9fr]">
            <blockquote className="space-y-6 text-center md:text-left">
              <p className="text-2xl text-white" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                {testimonial.quote}
              </p>
              <span className="text-sm uppercase tracking-[0.25em] text-emerald-200">{testimonial.author}</span>
            </blockquote>
            <div className="rounded-2xl bg-white/5 p-6 text-sm text-emerald-100 sm:p-8">
              <p className="text-lg font-semibold text-white">¿Listo para comenzar?</p>
              <p className="mt-2 text-sm text-emerald-100/80">
                Únete gratis y gestiona tu primera meta con plantillas preparadas. Solo necesitas 2 minutos.
              </p>
              <a
                href="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-[#030c06] transition hover:-translate-y-0.5 sm:w-auto"
              >
                Empieza ahora
              </a>
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
