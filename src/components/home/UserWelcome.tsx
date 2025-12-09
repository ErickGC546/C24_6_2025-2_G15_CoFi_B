'use client';

import { useEffect, useRef, useState } from 'react';

const AUTO_CAROUSEL_INTERVAL = 3500;

const slides = [
  {
    title: "Registra gastos con tu voz",
    description: "Tan simple como decir 'menos 40 soles en McDonald's' para registrar tus gastos al instante.",
    icon: "🎤"
  },
  {
    title: "Gestiona finanzas en grupo",
    description: "Comparte gastos y maneja el presupuesto con tu grupo de amigos o compañeros de clase.",
    icon: "👥"
  },
  {
    title: "Cumple tus metas de ahorro",
    description: "Define objetivos financieros y visualiza tu progreso hasta alcanzarlos.",
    icon: "🎯"
  }
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
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div style={{ background: 'rgba(34,197,94,0.10)', padding: '0.5rem 2.5rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 160, minHeight: 64, marginBottom: 8 }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 40, fontFamily: 'Inter, Arial, sans-serif', letterSpacing: 0.5 }}>COFI</span>
            </div>
            <p style={{ color: "#6b7280", fontSize: 18, margin: 0, fontFamily: 'Inter, Arial, sans-serif' }}>
              ¡Bienvenido {userName}!
            </p>
          </div>

          <div className="relative h-80 mt-12">
            {slides.map((slide, index) => (
              <div
                key={index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  opacity: currentSlide === index ? 1 : 0,
                  zIndex: currentSlide === index ? 10 : 0,
                  transition: "opacity 0.5s ease-in-out",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>
                  {slide.icon}
                </span>
                <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, marginTop: 0, color: "#212121", fontFamily: 'Inter, Arial, sans-serif' }}>
                  {slide.title}
                </h2>
                <p style={{ color: "#6b7280", fontSize: 20, fontFamily: 'Inter, Arial, sans-serif', margin: 0 }}>
                  {slide.description}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-center space-x-2 mt-2">
            {slides.map((_, index) => (
              <div
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '100%',
                  margin: '0 4px',
                  background: currentSlide === index ? '#22c55e' : '#e5e7eb'
                }}
              />
            ))}
          </div>

          <div className="mt-8">
            <a
              href="https://drive.google.com/uc?export=download&id=1U1kCOzs93iS89azrcBKjqPgEEK85D-g0"
              download="CoFi.apk"
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all transform hover:scale-105"
            >
              📱 Descargar App Android
            </a>
            <p className="text-sm text-gray-500 mt-4">
              Gestiona tus finanzas desde tu dispositivo móvil
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
