/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fondo ambiental animado compartido para Clásico, Pastel Oscuro y Pastel Claro.
 * Usa exclusivamente propiedades compuestas por GPU (transform, opacity).
 */

import React from 'react';
import { EstiloMuros } from '../types/murosLocos';

interface AmbientBackdropProps {
  variant: EstiloMuros;
  reducedMotion?: boolean;
  calmMotes?: boolean;
}

const ESTRELLAS_PASTEL_OSCURO = [
  { top: '9%', left: '14%', size: 'w-1.5 h-1.5', color: 'bg-[#D7C9FF]', dur: '4.4s', delay: '0s' },
  { top: '16%', left: '78%', size: 'w-2 h-2', color: 'bg-[#B4E8DF]', dur: '5.2s', delay: '-1.6s' },
  { top: '28%', left: '34%', size: 'w-1 h-1', color: 'bg-[#F8D0E0]', dur: '3.9s', delay: '-0.8s' },
  { top: '39%', left: '88%', size: 'w-1.5 h-1.5', color: 'bg-[#FCE8B8]', dur: '4.8s', delay: '-2.4s' },
  { top: '54%', left: '11%', size: 'w-2 h-2', color: 'bg-[#C4D8FF]', dur: '5.6s', delay: '-3.1s' },
  { top: '66%', left: '68%', size: 'w-1.5 h-1.5', color: 'bg-[#E2C9FF]', dur: '4.2s', delay: '-1.2s' },
  { top: '79%', left: '26%', size: 'w-1 h-1', color: 'bg-[#B4E8DF]', dur: '4.6s', delay: '-2.7s' },
  { top: '86%', left: '84%', size: 'w-1.5 h-1.5', color: 'bg-[#F8D0E0]', dur: '5.1s', delay: '-0.5s' },
];

const MOTAS_SERENAS_OSCURO = [
  { top: '14%', left: '8%', size: 'w-14 h-14', color: 'bg-[#A79AE6]/25', anim: 'candadoMoteDriftA', dur: '16s', delay: '0s' },
  { top: '24%', left: '84%', size: 'w-16 h-16', color: 'bg-[#7AC4B6]/22', anim: 'candadoMoteDriftB', dur: '19s', delay: '-5s' },
  { top: '48%', left: '20%', size: 'w-12 h-12', color: 'bg-[#E29EB8]/20', anim: 'candadoMoteDriftB', dur: '17s', delay: '-9s' },
  { top: '58%', left: '76%', size: 'w-20 h-20', color: 'bg-[#86B0DF]/20', anim: 'candadoMoteDriftA', dur: '22s', delay: '-3s' },
  { top: '78%', left: '14%', size: 'w-16 h-16', color: 'bg-[#94D4C0]/20', anim: 'candadoMoteDriftA', dur: '18s', delay: '-11s' },
  { top: '82%', left: '58%', size: 'w-14 h-14', color: 'bg-[#C5A4EB]/22', anim: 'candadoMoteDriftB', dur: '20s', delay: '-7s' },
];

const MOTAS_SERENAS_CLARO = [
  { top: '15%', left: '10%', size: 'w-16 h-16', color: 'bg-[#B9E6CE]/48', anim: 'candadoMoteDriftA', dur: '16s', delay: '0s' },
  { top: '22%', left: '82%', size: 'w-20 h-20', color: 'bg-[#C7DFFF]/50', anim: 'candadoMoteDriftB', dur: '19s', delay: '-4s' },
  { top: '46%', left: '18%', size: 'w-14 h-14', color: 'bg-[#F8D7DD]/48', anim: 'candadoMoteDriftB', dur: '17s', delay: '-8s' },
  { top: '60%', left: '78%', size: 'w-18 h-18', color: 'bg-[#F8E2AF]/50', anim: 'candadoMoteDriftA', dur: '21s', delay: '-2s' },
  { top: '78%', left: '12%', size: 'w-16 h-16', color: 'bg-[#DDD4FA]/48', anim: 'candadoMoteDriftA', dur: '18s', delay: '-10s' },
  { top: '84%', left: '62%', size: 'w-14 h-14', color: 'bg-[#C3EBDC]/46', anim: 'candadoMoteDriftB', dur: '20s', delay: '-6s' },
];

export const AmbientBackdrop: React.FC<AmbientBackdropProps> = ({
  variant,
  reducedMotion = false,
  calmMotes = false,
}) => {
  const motionClass = reducedMotion ? 'reduce-motion-bg' : 'ambient-backdrop-animated';

  if (variant === 'clasico') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${motionClass}`}
      >
        <div
          className="absolute top-10 w-48 h-16 bg-white/40 rounded-full blur-xs animate-[cloudDriftA_35s_linear_infinite]"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute top-36 w-64 h-20 bg-white/30 rounded-full blur-xs animate-[cloudDriftB_45s_linear_infinite]"
          style={{ animationDelay: '-15s' }}
        />
        <div
          className="absolute top-72 w-52 h-16 bg-white/35 rounded-full blur-xs animate-[cloudDriftC_40s_linear_infinite]"
          style={{ animationDelay: '-8s' }}
        />
      </div>
    );
  }

  if (variant === 'pastel_oscuro') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${motionClass}`}
      >
        {/* Nebulosas en tonos pastel oscuro con flotación orgánica */}
        <div
          className="absolute -top-20 -left-16 w-[380px] h-[280px] rounded-full bg-[#6857A8]/24 blur-3xl animate-[pastelOrbFloatA_28s_ease-in-out_infinite]"
        />
        <div
          className="absolute top-1/3 -right-20 w-[360px] h-[300px] rounded-full bg-[#3E7E78]/20 blur-3xl animate-[pastelOrbFloatB_34s_ease-in-out_infinite]"
          style={{ animationDelay: '-10s' }}
        />
        <div
          className="absolute -bottom-24 left-1/4 w-[420px] h-[260px] rounded-full bg-[#8D547C]/20 blur-3xl animate-[pastelOrbFloatA_38s_ease-in-out_infinite]"
          style={{ animationDelay: '-18s' }}
        />

        {/* Nubes nocturnas pastel oscuro desplazándose como en el estilo clásico */}
        <div
          className="absolute top-10 w-64 h-16 rounded-full bg-[#6B5FA6]/24 blur-md animate-[cloudDriftA_38s_linear_infinite]"
          style={{ animationDelay: '0s' }}
        >
          <div className="absolute -top-4 left-10 w-24 h-12 rounded-full bg-[#8275BE]/24" />
          <div className="absolute -top-3 right-12 w-20 h-10 rounded-full bg-[#6488B8]/22" />
        </div>

        <div
          className="absolute top-40 w-80 h-20 rounded-full bg-[#4A709E]/22 blur-md animate-[cloudDriftB_48s_linear_infinite]"
          style={{ animationDelay: '-19s' }}
        >
          <div className="absolute -top-5 left-16 w-28 h-14 rounded-full bg-[#5C88B8]/20" />
          <div className="absolute -top-3 right-16 w-24 h-12 rounded-full bg-[#7A63A8]/20" />
        </div>

        <div
          className="absolute top-[64%] w-72 h-18 rounded-full bg-[#8C567C]/20 blur-md animate-[cloudDriftC_43s_linear_infinite]"
          style={{ animationDelay: '-9s' }}
        >
          <div className="absolute -top-4 left-12 w-24 h-12 rounded-full bg-[#A26890]/20" />
          <div className="absolute -top-3 right-10 w-20 h-10 rounded-full bg-[#5D7A9E]/18" />
        </div>

        <div
          className="absolute bottom-14 w-60 h-14 rounded-full bg-[#3E7A74]/22 blur-md animate-[cloudDriftA_52s_linear_infinite]"
          style={{ animationDelay: '-27s' }}
        >
          <div className="absolute -top-3 left-10 w-22 h-10 rounded-full bg-[#53968E]/20" />
        </div>

        {/* Motas pastel flotantes relajantes */}
        {calmMotes &&
          MOTAS_SERENAS_OSCURO.map((m, idx) => (
            <div
              key={`mote-d-${idx}`}
              className={`absolute rounded-full blur-xl ${m.size} ${m.color}`}
              style={{
                top: m.top,
                left: m.left,
                animation: `${m.anim} ${m.dur} ease-in-out ${m.delay} infinite`,
              }}
            />
          ))}

        {/* Destellos nocturnos pastel suaves */}
        {ESTRELLAS_PASTEL_OSCURO.map((st, idx) => (
          <span
            key={idx}
            className={`absolute rounded-full ${st.size} ${st.color} animate-[pastelTwinkle_4.5s_ease-in-out_infinite]`}
            style={{
              top: st.top,
              left: st.left,
              animationDuration: st.dur,
              animationDelay: st.delay,
            }}
          />
        ))}
      </div>
    );
  }

  // variant === 'pastel_claro'
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${motionClass}`}
    >
      {/* Resplandores cálidos en tonos pastel claro */}
      <div
        className="absolute -top-20 -right-14 w-[380px] h-[280px] rounded-full bg-[#FCE4AE]/55 blur-3xl animate-[pastelOrbFloatA_30s_ease-in-out_infinite]"
      />
      <div
        className="absolute top-1/3 -left-20 w-[340px] h-[260px] rounded-full bg-[#D5E9FF]/50 blur-3xl animate-[pastelOrbFloatB_36s_ease-in-out_infinite]"
        style={{ animationDelay: '-12s' }}
      />
      <div
        className="absolute -bottom-24 right-1/4 w-[400px] h-[260px] rounded-full bg-[#FADAE0]/45 blur-3xl animate-[pastelOrbFloatA_40s_ease-in-out_infinite]"
        style={{ animationDelay: '-20s' }}
      />

      {/* Nubes pastel claro desplazándose suavemente como en Clásico */}
      <div
        className="absolute top-10 w-60 h-16 rounded-full bg-white/75 blur-xs animate-[cloudDriftA_36s_linear_infinite]"
        style={{ animationDelay: '0s' }}
      >
        <div className="absolute -top-4 left-9 w-24 h-12 rounded-full bg-[#FFF7E8]/80" />
        <div className="absolute -top-3 right-10 w-20 h-10 rounded-full bg-[#FDE6D4]/70" />
      </div>

      <div
        className="absolute top-40 w-76 h-20 rounded-full bg-[#DCEEFF]/65 blur-xs animate-[cloudDriftB_46s_linear_infinite]"
        style={{ animationDelay: '-16s' }}
      >
        <div className="absolute -top-5 left-14 w-28 h-14 rounded-full bg-white/70" />
        <div className="absolute -top-3 right-14 w-22 h-11 rounded-full bg-[#EAE2FC]/65" />
      </div>

      <div
        className="absolute top-[64%] w-64 h-16 rounded-full bg-[#EDE5FC]/65 blur-xs animate-[cloudDriftC_41s_linear_infinite]"
        style={{ animationDelay: '-8s' }}
      >
        <div className="absolute -top-4 left-10 w-24 h-12 rounded-full bg-white/75" />
        <div className="absolute -top-3 right-10 w-20 h-10 rounded-full bg-[#FADDE2]/60" />
      </div>

      <div
        className="absolute bottom-14 w-56 h-14 rounded-full bg-[#D5F2E3]/60 blur-xs animate-[cloudDriftA_50s_linear_infinite]"
        style={{ animationDelay: '-24s' }}
      >
        <div className="absolute -top-3 left-10 w-20 h-10 rounded-full bg-white/75" />
      </div>

      {/* Motas pastel flotantes relajantes */}
      {calmMotes &&
        MOTAS_SERENAS_CLARO.map((m, idx) => (
          <div
            key={`mote-l-${idx}`}
            className={`absolute rounded-full blur-xl ${m.size} ${m.color}`}
            style={{
              top: m.top,
              left: m.left,
              animation: `${m.anim} ${m.dur} ease-in-out ${m.delay} infinite`,
            }}
          />
        ))}
    </div>
  );
};
