/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HatType } from '../types/murosLocos';

interface CartoonCharacterProps {
  color: string;
  hat: HatType;
  size?: number;
  isActive?: boolean;
  isDancing?: boolean;
  className?: string;
  showShadow?: boolean;
}

export const CartoonCharacter: React.FC<CartoonCharacterProps> = ({
  color,
  hat,
  size = 56,
  isActive = false,
  isDancing = false,
  className = '',
  showShadow = true,
}) => {
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
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#1e1830" stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {showShadow && (
          <ellipse cx="50" cy="92" rx="28" ry="7" fill="#2b2140" opacity="0.25" />
        )}

        {/* Feet */}
        <ellipse cx="36" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />
        <ellipse cx="64" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />

        {/* Main Body */}
        <circle cx="50" cy="54" r="32" fill={color} stroke="#2b2140" strokeWidth="4" />
        <path
          d="M 28 42 A 25 25 0 0 1 54 26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Blush cheeks */}
        <circle cx="29" cy="62" r="5" fill="#ff8787" opacity="0.6" />
        <circle cx="71" cy="62" r="5" fill="#ff8787" opacity="0.6" />

        {/* Eyes */}
        <g className="animate-[blink_4s_ease-in-out_infinite]">
          <ellipse cx="39" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          <circle cx="41" cy="50" r="4.5" fill="#2b2140" />
          <circle cx="42.5" cy="48" r="1.8" fill="#ffffff" />

          <ellipse cx="61" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          <circle cx="63" cy="50" r="4.5" fill="#2b2140" />
          <circle cx="64.5" cy="48" r="1.8" fill="#ffffff" />
        </g>

        {/* Smile */}
        <path
          d="M 43 64 Q 50 72 57 64"
          fill="none"
          stroke="#2b2140"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

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

        {hat === 'robot' && (
          <g transform="translate(50, 24)">
            <rect x="-14" y="-8" width="28" height="10" rx="3" fill="#adb5bd" stroke="#2b2140" strokeWidth="3" />
            <line x1="0" y1="-8" x2="0" y2="-22" stroke="#2b2140" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="0" cy="-24" r="5.5" fill="#22b8cf" stroke="#2b2140" strokeWidth="2.5" className="animate-pulse" />
            <rect x="-42" y="16" width="6" height="12" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="2.5" />
            <rect x="36" y="16" width="6" height="12" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="2.5" />
            <rect x="-24" y="20" width="48" height="11" rx="4" fill="#15aabf" stroke="#2b2140" strokeWidth="2.5" opacity="0.85" />
            <line x1="-20" y1="25" x2="20" y2="25" stroke="#e3fafc" strokeWidth="2" strokeDasharray="3,2" />
          </g>
        )}

        {hat === 'bot_cpu' && (
          <g transform="translate(50, 24)">
            {/* Base metálica superior del CPU */}
            <rect x="-18" y="-10" width="36" height="12" rx="4" fill="#343a40" stroke="#1a1d20" strokeWidth="3" />
            <rect x="-12" y="-6" width="24" height="4" fill="#00f2fe" opacity="0.8" />
            
            {/* Antenas dobles anguladas cibernéticas con esferas LED */}
            <line x1="-12" y1="-10" x2="-22" y2="-24" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="-22" cy="-24" r="4.5" fill="#00f2fe" stroke="#1a1d20" strokeWidth="2" className="animate-pulse" />
            <line x1="12" y1="-10" x2="22" y2="-24" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="22" cy="-24" r="4.5" fill="#ff007f" stroke="#1a1d20" strokeWidth="2" className="animate-pulse" />

            {/* Sensores auditivos cilíndricos en las sienes */}
            <rect x="-44" y="14" width="8" height="16" rx="3" fill="#495057" stroke="#1a1d20" strokeWidth="2.5" />
            <circle cx="-40" cy="22" r="2" fill="#00f2fe" />
            <rect x="36" y="14" width="8" height="16" rx="3" fill="#495057" stroke="#1a1d20" strokeWidth="2.5" />
            <circle cx="40" cy="22" r="2" fill="#ff007f" />

            {/* Gran Visor Digital Cibernético con matriz LED */}
            <rect x="-26" y="18" width="52" height="16" rx="5" fill="#090a0f" stroke="#1a1d20" strokeWidth="3" />
            <rect x="-23" y="21" width="46" height="10" rx="3" fill="#101a28" />
            {/* Ojos digitales hexagonales brillantes */}
            <rect x="-18" y="23" width="10" height="6" rx="1.5" fill="#00f2fe" className="animate-pulse" />
            <rect x="8" y="23" width="10" height="6" rx="1.5" fill="#00f2fe" className="animate-pulse" />
            {/* Línea de escaneo láser central */}
            <line x1="-6" y1="26" x2="6" y2="26" stroke="#ff007f" strokeWidth="2" strokeDasharray="2,2" />
          </g>
        )}

        {hat === 'dragon' && (
          <g>
            <path
              d="M 26 32 C 16 22 10 7 20 2 C 26 8 28 18 36 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M 74 32 C 84 22 90 7 80 2 C 74 8 72 18 64 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <polygon points="46,24 50,14 54,24" fill="#12b886" stroke="#2b2140" strokeWidth="2" />
            <polygon points="47,15 50,7 53,15" fill="#12b886" stroke="#2b2140" strokeWidth="2" />
            <polygon points="43,65 46,70 47,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
            <polygon points="53,65 54,70 57,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
          </g>
        )}

        {hat === 'ninja' && (
          <g>
            <path d="M 20 40 Q 6 36 2 48 Q 12 44 22 46 Z" fill="#212529" stroke="#2b2140" strokeWidth="3" />
            <path d="M 18 44 Q 4 48 0 60 Q 10 52 20 48 Z" fill="#343a40" stroke="#2b2140" strokeWidth="2.5" />
            <rect x="20" y="32" width="60" height="12" rx="4" fill="#212529" stroke="#2b2140" strokeWidth="3" />
            <rect x="38" y="34" width="24" height="8" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="2" />
            <path
              d="M 50 35 L 51.5 38 L 54 38 L 52 39.5 L 53 42 L 50 40.5 L 47 42 L 48 39.5 L 46 38 L 48.5 38 Z"
              fill="#ffd43b"
            />
            <path d="M 28 60 Q 50 78 72 60 L 68 76 Q 50 86 32 76 Z" fill="#212529" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}
      </svg>
    </div>
  );
};
