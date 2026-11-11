import React from 'react';
import { HatType, PersonajeAuraType, PersonajeRopaType } from '../types/murosLocos';

interface CartoonCharacterProps {
  color: string;
  hat: HatType;
  ropa?: PersonajeRopaType;
  ropaColor?: string;
  aura?: PersonajeAuraType;
  size?: number;
  isActive?: boolean;
  isDancing?: boolean;
  className?: string;
  showShadow?: boolean;
  inGame?: boolean;
}

export const CartoonCharacter: React.FC<CartoonCharacterProps> = ({
  color,
  hat,
  ropa = 'ninguna',
  ropaColor,
  aura = 'ninguna',
  size = 56,
  isActive = false,
  isDancing = false,
  className = '',
  showShadow = true,
  inGame = false,
}) => {
  const isRobot = hat === 'robot' || hat === 'bot_cpu';
  const isNinja = hat === 'ninja';
  const isDragon = hat === 'dragon';

  // Si está en partida (inGame), el aura solo resplandece cuando le toca jugar al jugador
  const mostrarAura = !inGame || isActive;

  // Colores personalizables de ropa
  const colCapa = ropaColor || '#c92a2a';
  const colArmadura = ropaColor || '#adb5bd';
  const colTunica = ropaColor || '#5f3dc4';
  const colSmoking = ropaColor || '#212529';
  const colCinturon = ropaColor || '#fab005';
  const colAlas = ropaColor || '#e7f5ff';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full overflow-visible transition-transform duration-300 ${
          isDancing ? 'animate-bounce' : isActive ? 'animate-pulse scale-105' : ''
        }`}
      >
        <defs>
          <radialGradient id={`bodyGrad-${color.replace('#', '')}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#1e1830" stopOpacity="0.35" />
          </radialGradient>

          {/* Aura Dorada Potente */}
          <radialGradient id="auraGoldGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff9db" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#ffd43b" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#f59f00" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffd43b" stopOpacity="0" />
          </radialGradient>

          {/* Aura Fuego */}
          <radialGradient id="auraFireGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffc078" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ff922b" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#f03e3e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c92a2a" stopOpacity="0" />
          </radialGradient>

          {/* Aura Cíber */}
          <radialGradient id="auraCyberGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#99e9f2" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#22b8cf" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#15aabf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0c8599" stopOpacity="0" />
          </radialGradient>

          {/* Aura Arcoíris Estática (Halo cósmico difuso sin giro/mareo) */}
          <radialGradient id="auraRainbowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="#ffe066" stopOpacity="0.8" />
            <stop offset="52%" stopColor="#69db7c" stopOpacity="0.65" />
            <stop offset="68%" stopColor="#4dabf7" stopOpacity="0.65" />
            <stop offset="84%" stopColor="#da77f2" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff8787" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ============================================================== */}
        {/* AURAS (Detrás del cuerpo) */}
        {/* ============================================================== */}
        {mostrarAura && (
          <g className="transition-opacity duration-300">
            {aura === 'dorada' && (
              <circle
                cx="50"
                cy="54"
                r="47"
                fill="url(#auraGoldGrad)"
                style={{ filter: 'drop-shadow(0 0 10px rgba(255, 212, 59, 0.75))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'fuego' && (
              <circle
                cx="50"
                cy="54"
                r="46"
                fill="url(#auraFireGrad)"
                style={{ filter: 'drop-shadow(0 0 8px rgba(240, 62, 62, 0.6))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'ciber' && (
              <circle
                cx="50"
                cy="54"
                r="46"
                fill="url(#auraCyberGrad)"
                style={{ filter: 'drop-shadow(0 0 8px rgba(34, 184, 207, 0.6))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'arcoiris' && (
              /* Sombra cósmica suave y fija sin giro que no marea */
              <circle
                cx="50"
                cy="54"
                r="48"
                fill="url(#auraRainbowGrad)"
                style={{ filter: 'drop-shadow(0 0 9px rgba(186, 120, 255, 0.55))' }}
              />
            )}
          </g>
        )}

        {/* ============================================================== */}
        {/* ROPA TRASERA: CAPA Y ALAS (Nacen de la espalda media/baja) */}
        {/* ============================================================== */}
        {ropa === 'capa' && (
          <g>
            <path
              d="M 27 52 Q 10 76 18 90 L 82 90 Q 90 76 73 52 Z"
              fill={colCapa}
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Pliegue y dobladillo dorado */}
            <path d="M 23 88 L 77 88" stroke="#ffd43b" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 38 60 Q 32 75 36 88" stroke="#000000" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
            <path d="M 62 60 Q 68 75 64 88" stroke="#000000" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
          </g>
        )}

        {ropa === 'alas' && (
          <g>
            {/* Ala Izquierda (Baja, sale de la espalda media) */}
            <path
              d="M 28 54 C 8 46 0 62 4 78 C 14 82 22 72 30 64 Z"
              fill={colAlas}
              stroke="#2b2140"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M 8 62 C 16 66 22 68 28 62" stroke="#74c0fc" strokeWidth="2" fill="none" />
            {/* Ala Derecha */}
            <path
              d="M 72 54 C 92 46 100 62 96 78 C 86 82 78 72 70 64 Z"
              fill={colAlas}
              stroke="#2b2140"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M 92 62 C 84 66 78 68 72 62" stroke="#74c0fc" strokeWidth="2" fill="none" />
          </g>
        )}

        {/* Sombra inferior en el suelo */}
        {showShadow && (
          <ellipse cx="50" cy="92" rx="28" ry="7" fill="#2b2140" opacity="0.25" />
        )}

        {/* Patitas */}
        <ellipse cx="36" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />
        <ellipse cx="64" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />

        {/* Cuerpo Principal */}
        <circle cx="50" cy="54" r="32" fill={color} stroke="#2b2140" strokeWidth="4" />
        <path
          d="M 28 42 A 25 25 0 0 1 54 26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* ============================================================== */}
        {/* TEXTURA DE ESCAMAS DE DRAGÓN */}
        {/* ============================================================== */}
        {isDragon && (
          <g opacity="0.45" stroke="#2b2140" strokeWidth="1.8" fill="none">
            {/* Fila 1 de escamas */}
            <path d="M 44 48 Q 47 52 50 48 Q 53 52 56 48" strokeLinecap="round" />
            {/* Fila 2 de escamas */}
            <path d="M 40 56 Q 45 61 50 56 Q 55 61 60 56" strokeLinecap="round" />
            {/* Fila 3 de escamas */}
            <path d="M 43 65 Q 47 69 50 65 Q 53 69 57 65" strokeLinecap="round" />
            {/* Panza dorada clara del dragón */}
            <path d="M 38 72 Q 50 78 62 72 Q 50 82 38 72 Z" fill="#fff3bf" opacity="0.6" strokeWidth="1.5" />
          </g>
        )}

        {/* Mejillas sonrosadas (solo si no es robot) */}
        {!isRobot && (
          <>
            <circle cx="29" cy="62" r="5" fill="#ff8787" opacity="0.6" />
            <circle cx="71" cy="62" r="5" fill="#ff8787" opacity="0.6" />
          </>
        )}

        {/* ============================================================== */}
        {/* OJOS (Si es Robot, tiene visor cibernético en su lugar) */}
        {/* ============================================================== */}
        {!isRobot && (
          <g className="animate-[blink_4s_ease-in-out_infinite]">
            <ellipse cx="39" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
            <circle cx="41" cy="50" r="4.5" fill="#2b2140" />
            <circle cx="42.5" cy="48" r="1.8" fill="#ffffff" />

            <ellipse cx="61" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
            <circle cx="63" cy="50" r="4.5" fill="#2b2140" />
            <circle cx="64.5" cy="48" r="1.8" fill="#ffffff" />
          </g>
        )}

        {/* ============================================================== */}
        {/* BOCA / SONRISA (Oculta en Ninja y Robot) */}
        {/* ============================================================== */}
        {!isNinja && !isRobot && (
          <path
            d="M 43 64 Q 50 72 57 64"
            fill="none"
            stroke="#2b2140"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        {/* ============================================================== */}
        {/* ROPA DELANTERA: ARMADURA, SMOKING, CINTURÓN, TÚNICA */}
        {/* ============================================================== */}
        {ropa === 'armadura' && (
          <g>
            {/* Hombrera izquierda */}
            <ellipse cx="27" cy="64" rx="7" ry="5" fill={colArmadura} stroke="#2b2140" strokeWidth="2.5" />
            <ellipse cx="27" cy="64" rx="4" ry="2.5" fill="#ffffff" opacity="0.4" />
            {/* Hombrera derecha */}
            <ellipse cx="73" cy="64" rx="7" ry="5" fill={colArmadura} stroke="#2b2140" strokeWidth="2.5" />
            <ellipse cx="73" cy="64" rx="4" ry="2.5" fill="#ffffff" opacity="0.4" />

            {/* Peto curvo anatomico (bajo la boca, respeta la cara) */}
            <path
              d="M 32 68 Q 50 73 68 68 L 65 85 Q 50 88 35 85 Z"
              fill={colArmadura}
              stroke="#2b2140"
              strokeWidth="3"
            />
            {/* Placas y relieve de coraza */}
            <path d="M 40 70 L 46 80 L 54 80 L 60 70" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" fill="none" />
            <polygon points="50,71 54,76 46,76" fill="#ffd43b" stroke="#2b2140" strokeWidth="1.2" />

            {/* Escudo de torneo en el flanco izquierdo */}
            <path
              d="M 72 62 Q 81 64 79 74 Q 76 81 72 83 Q 68 81 65 74 Q 63 64 72 62 Z"
              fill="#e03131"
              stroke="#2b2140"
              strokeWidth="2.5"
            />
            <line x1="72" y1="64" x2="72" y2="81" stroke="#ffd43b" strokeWidth="2" />
            <line x1="66" y1="71" x2="78" y2="71" stroke="#ffd43b" strokeWidth="2" />
          </g>
        )}

        {ropa === 'smoking' && (
          <g>
            {/* Solapas del traje */}
            <path d="M 36 68 L 44 85 L 56 85 L 64 68 Z" fill={colSmoking} stroke="#2b2140" strokeWidth="2.5" />
            {/* Camisa blanca interna */}
            <polygon points="43,68 57,68 50,79" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
            {/* Pajarita roja */}
            <polygon points="44,68 50,70.5 44,73" fill="#e03131" stroke="#2b2140" strokeWidth="1" />
            <polygon points="56,68 50,70.5 56,73" fill="#e03131" stroke="#2b2140" strokeWidth="1" />
            <circle cx="50" cy="70.5" r="1.5" fill="#ffd43b" />
            {/* Botones dorados */}
            <circle cx="50" cy="77" r="1.2" fill="#ffd43b" />
            <circle cx="50" cy="81" r="1.2" fill="#ffd43b" />
          </g>
        )}

        {ropa === 'cinturon' && (
          <g>
            <rect x="29" y="74" width="42" height="9" rx="3" fill={colCinturon} stroke="#2b2140" strokeWidth="2.5" />
            {/* Hebilla de oro con gema rubí */}
            <rect x="44" y="72.5" width="12" height="12" rx="2.5" fill="#ffd43b" stroke="#2b2140" strokeWidth="2" />
            <circle cx="50" cy="78.5" r="3" fill="#e03131" stroke="#2b2140" strokeWidth="1.2" />
          </g>
        )}

        {ropa === 'tunica' && (
          <g>
            <path
              d="M 33 68 Q 50 72 67 68 L 64 86 Q 50 89 36 86 Z"
              fill={colTunica}
              stroke="#2b2140"
              strokeWidth="2.5"
            />
            {/* Cinto cruzado dorado */}
            <path d="M 35 76 Q 50 79 65 76" stroke="#ffd43b" strokeWidth="2.5" fill="none" />
            <circle cx="50" cy="77" r="2.2" fill="#ffd43b" stroke="#2b2140" strokeWidth="1" />
          </g>
        )}

        {/* ============================================================== */}
        {/* SOMBREROS Y ACCESORIOS DE CABEZA */}
        {/* ============================================================== */}
        {hat === 'corona' && (
          <g transform="translate(50, 22)">
            <path
              d="M -22 0 L -16 -18 L -6 -6 L 0 -22 L 6 -6 L 16 -18 L 22 0 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <circle cx="0" cy="-6" r="3" fill="#ff6b6b" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="-11" cy="-4" r="2.5" fill="#4dabf7" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="11" cy="-4" r="2.5" fill="#51cf66" stroke="#2b2140" strokeWidth="1.5" />
          </g>
        )}

        {hat === 'pompon' && (
          <g transform="translate(50, 23)">
            <path
              d="M -20 2 C -20 -18 20 -18 20 2 Z"
              fill="#339af0"
              stroke="#2b2140"
              strokeWidth="3.5"
            />
            <path d="M -16 -6 Q 0 -12 16 -6" fill="none" stroke="#ffffff" strokeWidth="3" />
            <rect
              x="-22"
              y="0"
              width="44"
              height="6"
              rx="3"
              fill="#e7f5ff"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <circle cx="0" cy="-18" r="7" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {hat === 'antena' && (
          <g transform="translate(50, 22)">
            <rect
              x="-7"
              y="-2"
              width="14"
              height="5"
              rx="2"
              fill="#ced4da"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <path d="M 0 -2 L 0 -18" fill="none" stroke="#2b2140" strokeWidth="4" strokeLinecap="round" />
            <circle cx="0" cy="-22" r="6.5" fill="#ff6b6b" stroke="#2b2140" strokeWidth="3" />
            <circle cx="2" cy="-24" r="2" fill="#ffffff" />
          </g>
        )}

        {hat === 'brote' && (
          <g transform="translate(50, 22)">
            <path d="M 0 0 Q 3 -12 0 -16" fill="none" stroke="#2b2140" strokeWidth="4" strokeLinecap="round" />
            <path d="M 0 -14 C -12 -16 -12 -6 0 -10 Z" fill="#69db7c" stroke="#2b2140" strokeWidth="3" />
            <path d="M 0 -15 C 14 -18 14 -6 0 -11 Z" fill="#8ce99a" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {hat === 'mago' && (
          <g transform="translate(50, 24)">
            <ellipse cx="0" cy="2" rx="24" ry="6" fill="#5f3dc4" stroke="#2b2140" strokeWidth="3.5" />
            <path
              d="M -16 1 Q -8 -22 14 -30 Q 8 -16 16 1 Z"
              fill="#7950f2"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M -15 0 Q 0 -4 15 0" fill="none" stroke="#ffd43b" strokeWidth="3" />
            <path
              d="M 14 -32 L 15.5 -29 L 19 -29 L 16.5 -27 L 17.5 -24 L 14 -26 L 10.5 -24 L 11.5 -27 L 9 -29 L 12.5 -29 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="1.5"
            />
          </g>
        )}

        {hat === 'gatito' && (
          <g>
            <path
              d="M 24 35 L 20 12 L 39 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 25 31 L 22 17 L 35 25 Z" fill="#ffdeeb" />
            <path
              d="M 76 35 L 80 12 L 61 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 75 31 L 78 17 L 65 25 Z" fill="#ffdeeb" />
            {/* Bigotes */}
            <path d="M 16 57 L 27 58 M 15 62 L 27 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 84 57 L 73 58 M 85 62 L 73 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {hat === 'zorro' && (
          <g>
            <path
              d="M 21 34 L 16 7 L 39 24 Z"
              fill="#f76707"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 22 28 L 18 13 L 34 23 Z" fill="#fff4e6" />
            <path
              d="M 79 34 L 84 7 L 61 24 Z"
              fill="#f76707"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 78 28 L 82 13 L 66 23 Z" fill="#fff4e6" />
            <ellipse cx="50" cy="62" rx="7" ry="5" fill="#fff4e6" stroke="#2b2140" strokeWidth="2" />
            <polygon points="47,59 53,59 50,63" fill="#2b2140" />
            <path d="M 18 56 L 28 58 M 17 62 L 28 61" stroke="#2b2140" strokeWidth="2" strokeLinecap="round" />
            <path d="M 82 56 L 72 58 M 83 62 L 72 61" stroke="#2b2140" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* CYBER BOT: Sin ojos de caricatura, con visor robótico panorámico continuo */}
        {(hat === 'robot' || hat === 'bot_cpu') && (
          <g transform="translate(50, 50)">
            {/* Soporte de la antena superior */}
            <rect x="-14" y="-34" width="28" height="9" rx="3" fill="#343a40" stroke="#2b2140" strokeWidth="2.5" />
            <line x1="0" y1="-34" x2="0" y2="-45" stroke="#2b2140" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="0" cy="-47" r="5" fill="#22b8cf" stroke="#2b2140" strokeWidth="2.5" className="animate-pulse" />

            {/* Sensores/tornillos laterales */}
            <rect x="-35" y="-6" width="6" height="14" rx="2" fill="#868e96" stroke="#2b2140" strokeWidth="2" />
            <circle cx="-32" cy="1" r="1.5" fill="#22b8cf" />
            <rect x="29" y="-6" width="6" height="14" rx="2" fill="#868e96" stroke="#2b2140" strokeWidth="2" />
            <circle cx="32" cy="1" r="1.5" fill="#22b8cf" />

            {/* Gran Visor Digital Panorámico de lado a lado */}
            <rect
              x="-30"
              y="-7"
              width="60"
              height="15"
              rx="5"
              fill="#101a28"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <rect x="-27" y="-4" width="54" height="9" rx="3" fill="#090a0f" />

            {/* Escáner láser cian que recorre el visor */}
            <line x1="-24" y1="0.5" x2="24" y2="0.5" stroke="#22b8cf" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="-10" y="-3" width="20" height="7" rx="2" fill="#00f2fe" opacity="0.9" className="animate-pulse" />
            <circle cx="0" cy="0.5" r="2.5" fill="#ffffff" />
          </g>
        )}

        {/* DRAGÓN: Cuernos, crestas dorsales y colmillos */}
        {hat === 'dragon' && (
          <g>
            {/* Cuerno Izquierdo */}
            <path
              d="M 26 32 C 16 20 10 6 22 2 C 28 8 30 18 36 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Cuerno Derecho */}
            <path
              d="M 74 32 C 84 20 90 6 78 2 C 72 8 70 18 64 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Crestas superiores */}
            <polygon points="46,24 50,14 54,24" fill="#0ca678" stroke="#2b2140" strokeWidth="2" />
            <polygon points="47,15 50,7 53,15" fill="#0ca678" stroke="#2b2140" strokeWidth="2" />
            {/* Colmillos */}
            <polygon points="42,65 45,71 47,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
            <polygon points="53,65 55,71 58,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
          </g>
        )}

        {/* NINJA: Sin boca sobre la máscara, cubre de la nariz hacia abajo */}
        {hat === 'ninja' && (
          <g>
            {/* Cinta con nudos en la cabeza */}
            <path d="M 20 40 Q 6 36 2 48 Q 12 44 22 46 Z" fill="#212529" stroke="#2b2140" strokeWidth="3" />
            <path d="M 18 44 Q 4 48 0 60 Q 10 52 20 48 Z" fill="#343a40" stroke="#2b2140" strokeWidth="2.5" />
            <rect x="20" y="32" width="60" height="13" rx="4" fill="#212529" stroke="#2b2140" strokeWidth="3" />
            {/* Placa metálica ninja */}
            <rect x="38" y="34.5" width="24" height="8" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="2" />
            <circle cx="42" cy="38.5" r="1.2" fill="#2b2140" />
            <circle cx="58" cy="38.5" r="1.2" fill="#2b2140" />
            <path
              d="M 50 35.5 L 51.5 38 L 54 38 L 52 39.5 L 53 42 L 50 40.5 L 47 42 L 48 39.5 L 46 38 L 48.5 38 Z"
              fill="#ffd43b"
            />
            {/* Máscara inferior que envuelve de la nariz abajo */}
            <path
              d="M 24 58 Q 50 63 76 58 L 72 79 Q 50 87 28 79 Z"
              fill="#212529"
              stroke="#2b2140"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* Pliegue de tela del tapabocas */}
            <path d="M 34 68 Q 50 72 66 68" stroke="#343a40" strokeWidth="2" fill="none" />
          </g>
        )}

        {/* ============================================================== */}
        {/* NUEVOS SOMBREROS Y ACCESORIOS */}
        {/* ============================================================== */}
        {/* GORRO NAVIDEÑO */}
        {hat === 'navidad' && (
          <g transform="translate(50, 24)">
            {/* Cono rojo curvado */}
            <path
              d="M -22 0 Q -10 -28 16 -24 Q 28 -20 28 -4 L 20 0 Z"
              fill="#e03131"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Borde de lana blanca */}
            <rect x="-24" y="-3" width="48" height="9" rx="4.5" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
            {/* Pompón caído */}
            <circle cx="28" cy="-2" r="7" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {/* SOMBRERO DE GRANJERO (Paja campestre) */}
        {hat === 'granjero' && (
          <g transform="translate(50, 25)">
            {/* Copa del sombrero */}
            <path d="M -16 0 L -12 -18 Q 0 -22 12 -18 L 16 0 Z" fill="#ffd43b" stroke="#2b2140" strokeWidth="3" />
            <path d="M -13 -6 Q 0 -9 13 -6" stroke="#c92a2a" strokeWidth="3" fill="none" />
            {/* Ala ancha de paja */}
            <ellipse cx="0" cy="1" rx="29" ry="8" fill="#fcc419" stroke="#2b2140" strokeWidth="3.5" />
            <path d="M -22 1 Q 0 -3 22 1" stroke="#f08c00" strokeWidth="1.8" fill="none" />
          </g>
        )}

        {/* CASCO VIKINGO */}
        {hat === 'vikingo' && (
          <g transform="translate(50, 24)">
            {/* Cuerno izquierdo */}
            <path d="M -18 -4 C -28 -12 -34 -26 -24 -32 C -20 -24 -14 -16 -10 -8 Z" fill="#fff9db" stroke="#2b2140" strokeWidth="3" />
            {/* Cuerno derecho */}
            <path d="M 18 -4 C 28 -12 34 -26 24 -32 C 20 -24 14 -16 10 -8 Z" fill="#fff9db" stroke="#2b2140" strokeWidth="3" />
            {/* Domo del casco */}
            <path d="M -20 2 Q 0 -24 20 2 Z" fill="#868e96" stroke="#2b2140" strokeWidth="3.5" />
            {/* Banda y remaches */}
            <rect x="-22" y="0" width="44" height="6" rx="2" fill="#adb5bd" stroke="#2b2140" strokeWidth="3" />
            <circle cx="-12" cy="3" r="1.5" fill="#343a40" />
            <circle cx="0" cy="3" r="1.5" fill="#343a40" />
            <circle cx="12" cy="3" r="1.5" fill="#343a40" />
          </g>
        )}

        {/* CHISTERA / SOMBRERO DE COPA */}
        {hat === 'copa' && (
          <g transform="translate(50, 23)">
            {/* Copa alta */}
            <path d="M -15 2 L -13 -26 L 13 -26 L 15 2 Z" fill="#212529" stroke="#2b2140" strokeWidth="3.5" />
            {/* Cinta carmesí de satén */}
            <rect x="-14" y="-7" width="28" height="7" fill="#c92a2a" stroke="#2b2140" strokeWidth="1.5" />
            {/* Ala del sombrero */}
            <ellipse cx="0" cy="3" rx="26" ry="6" fill="#343a40" stroke="#2b2140" strokeWidth="3.5" />
          </g>
        )}

        {/* GORRA DEPORTIVA */}
        {hat === 'gorra' && (
          <g transform="translate(50, 24)">
            {/* Corona de la gorra */}
            <path d="M -19 2 Q 0 -18 19 2 Z" fill="#1971c2" stroke="#2b2140" strokeWidth="3.5" />
            <circle cx="0" cy="-16" r="2.5" fill="#ffd43b" stroke="#2b2140" strokeWidth="1.5" />
            {/* Visera frontal */}
            <path d="M -6 2 Q 18 2 28 8 Q 16 10 -6 3 Z" fill="#1864ab" stroke="#2b2140" strokeWidth="3" strokeLinejoin="round" />
          </g>
        )}

        {/* BOINA DE ARTISTA */}
        {hat === 'boina' && (
          <g transform="translate(50, 24)">
            {/* Plato de la boina inclinado */}
            <ellipse cx="2" cy="-4" rx="25" ry="9" transform="rotate(-8)" fill="#ae3ec9" stroke="#2b2140" strokeWidth="3.5" />
            {/* Rabillo central */}
            <line x1="2" y1="-13" x2="2" y2="-17" stroke="#2b2140" strokeWidth="3" strokeLinecap="round" />
            <path d="M -16 2 Q 0 4 16 0" stroke="#862e9c" strokeWidth="2.5" fill="none" />
          </g>
        )}

        {/* CASCO ESPACIAL (Burbuja de astronauta) */}
        {hat === 'espacial' && (
          <g transform="translate(50, 26)">
            {/* Cuello del traje */}
            <rect x="-24" y="0" width="48" height="6" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="3" />
            {/* Escafandra transparente */}
            <ellipse cx="0" cy="-3" rx="27" ry="22" fill="#3bc9db" fillOpacity="0.25" stroke="#2b2140" strokeWidth="3.5" />
            {/* Reflejo curvo del cristal */}
            <path d="M -18 -15 Q -6 -22 8 -20" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
            <circle cx="-16" cy="-8" r="2" fill="#ffffff" opacity="0.8" />
          </g>
        )}
      </svg>
    </div>
  );
};
