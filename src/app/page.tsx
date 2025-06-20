'use client';

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { User as FirebaseUser } from 'firebase/auth';

const AUTO_CAROUSEL_INTERVAL = 3500;

function AutoCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const slides = [
    {
      title: "Registra gastos con tu voz",
      description: "Tan simple como decir 'menos 40 soles en McDonald's' para registrar tus gastos al instante.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>🎤</span>
    },
    {
      title: "Gestiona finanzas en grupo",
      description: "Comparte gastos y maneja el presupuesto con tu familia, pareja o compañeros de casa.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>👥</span>
    },
    {
      title: "Cumple tus metas de ahorro",
      description: "Define objetivos financieros y visualiza tu progreso hasta alcanzarlos.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>🎯</span>
    }
  ];

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
              Finanzas conscientes y colaborativas
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
                {slide.icon}
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
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {!user ? (
        <AutoCarousel />
      ) : (
        <div className="p-10">
          <div className="flex flex-col items-start mb-8">
            <h1 className="text-3xl font-bold mb-1">
              ¡Hola, {user.displayName || 'Usuario'}!
            </h1>
            <p className="text-lg text-gray-400 mb-6">Resumen de tus finanzas</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Acciones rápidas</h2>
            <div className="flex gap-6 mb-8">
              <button className="flex flex-col items-center justify-center border border-gray-200 rounded-2xl px-12 py-8 bg-white hover:bg-green-50 transition w-64" type="button">
                <span className="text-2xl mb-2">＋</span>
                <span className="text-base font-medium text-gray-700">Agregar gasto</span>
              </button>
              <button className="flex flex-col items-center justify-center border border-gray-200 rounded-2xl px-12 py-8 bg-white hover:bg-green-50 transition w-64" type="button">
                <span className="text-2xl mb-2">💳</span>
                <span className="text-base font-medium text-gray-700">Nueva cuenta</span>
              </button>
            </div>
            <h2 className="text-xl font-semibold mt-8">Reportes</h2>
          </div>
        </div>
      )}
    </>
  );
}
