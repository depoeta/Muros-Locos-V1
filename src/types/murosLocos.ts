// ============================================================================
// TIPOS GLOBALES DE MUROS LOCOS
// ============================================================================

export type TipoDeJugador = 'humano' | 'bot_facil' | 'bot_normal' | 'bot_dificil';

export type AvatarTipoDeGorro =
  | 'corona'
  | 'pompon'
  | 'antena'
  | 'brote'
  | 'mago'
  | 'gatito'
  | 'zorro'
  | 'robot'
  | 'dragon'
  | 'ninja'
  | 'navidad'
  | 'granjero'
  | 'vikingo'
  | 'copa'
  | 'gorra'
  | 'boina'
  | 'espacial'
  | 'bot_cpu';

export type AvatarTipoDeRopa =
  | 'ninguna'
  | 'capa'
  | 'armadura'
  | 'tuxedo'
  | 'smoking'
  | 'cinturon'
  | 'alas'
  | 'tunica';

export type AvatarTipoDeAura =
  | 'ninguna'
  | 'dorada'
  | 'fuego'
  | 'ciber'
  | 'arcoiris';

export type UserRol = 'dev' | 'admin' | 'mod' | 'jugador';

export type EstiloVisual = 'clasico' | 'minimalista';

export interface AvatarColeccionable {
  id: string;
  nombre: string;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  descripcion?: string;
  fechaAdquisicion: string;
  origen:
    | 'regalo_dev'
    | 'regalo_admin'
    | 'torneo_semanal'
    | {
        tipo: 'regalo_dev' | 'regalo_admin' | 'torneo_semanal';
        otorgadoPor: string;
        fecha: string;
      };
}

export interface UserInventario {
  personajes: AvatarColeccionable[];
  activoId?: string;
}

export type TamanoTablero = 5 | 7 | 9;

export interface SalaPersonalizada {
  codigo: string;
  nombre: string;
  creador: string;
  creadorRol: UserRol;
  maxJugadores: 2 | 4;
  modoMuros: 'estandar' | 'tactico' | 'caos';
  tamanoTablero: TamanoTablero;
  mensajeEspecial?: string;
  creadaEn: number;
}

export type OrientacionMuro = 'H' | 'V';

export interface DefPersonaje {
  id: AvatarTipoDeGorro;
  nombre: string;
  emoji: string;
  colorDefault: string;
  desbloqueoTipo: 'inicial' | 'puntos' | 'exclusivo';
  puntosRequeridos: number;
  descripcion: string;
  exclusivo?: boolean;
}

export const RegDeAvatar: DefPersonaje[] = [
  // 5 Iniciales (Siempre disponibles desde el principio)
  { id: 'corona', nombre: 'Realeza', emoji: '👑', colorDefault: '#ff6b6b', desbloqueoTipo: 'inicial', puntosRequeridos: 0, descripcion: 'Sólo la realeza debe de estar aquí.' },
  { id: 'pompon', nombre: 'Nieve', emoji: '❄️', colorDefault: '#339af0', desbloqueoTipo: 'inicial', puntosRequeridos: 0, descripcion: 'No soy fría, pero tampoco permito.' },
  { id: 'antena', nombre: 'Alien', emoji: '👽', colorDefault: '#51cf66', desbloqueoTipo: 'inicial', puntosRequeridos: 0, descripcion: 'Capta las mejores rutas con su radar espacial.' },
  { id: 'brote', nombre: 'Elfo', emoji: '🌱', colorDefault: '#20c997', desbloqueoTipo: 'inicial', puntosRequeridos: 0, descripcion: 'Ágil guardián de la naturaleza.' },
  { id: 'mago', nombre: 'Mago', emoji: '🧙', colorDefault: '#7950f2', desbloqueoTipo: 'inicial', puntosRequeridos: 0, descripcion: 'Domina los trucos de muros invisibles.' },
  // 12 Desbloqueables por puntos (ajustables por el Dev)
  { id: 'gatito', nombre: 'Gatito', emoji: '🐱', colorDefault: '#f06595', desbloqueoTipo: 'puntos', puntosRequeridos: 50, descripcion: 'Tierno y veloz entre los laberintos.' },
  { id: 'zorro', nombre: 'Astuto', emoji: '🦊', colorDefault: '#fd7e14', desbloqueoTipo: 'puntos', puntosRequeridos: 100, descripcion: 'Maestro de las fintas y bloqueos precisos.' },
  { id: 'robot', nombre: 'Bot', emoji: '🤖', colorDefault: '#868e96', desbloqueoTipo: 'puntos', puntosRequeridos: 150, descripcion: 'Visor cibernético que calcula cada paso.' },
  { id: 'dragon', nombre: 'Dragón', emoji: '🐲', colorDefault: '#20c997', desbloqueoTipo: 'puntos', puntosRequeridos: 200, descripcion: 'Escamas milenarias y fuego en el tablero.' },
  { id: 'ninja', nombre: 'Ninja', emoji: '🥷', colorDefault: '#212529', desbloqueoTipo: 'puntos', puntosRequeridos: 250, descripcion: 'Sigiloso estratega oculto en las sombras.' },
  { id: 'navidad', nombre: 'Navidad', emoji: '🎅', colorDefault: '#e03131', desbloqueoTipo: 'puntos', puntosRequeridos: 300, descripcion: 'Trae alegría navideña a cada partida.' },
  { id: 'granjero', nombre: 'Granjero', emoji: '🤠', colorDefault: '#fab005', desbloqueoTipo: 'puntos', puntosRequeridos: 350, descripcion: 'Construye los muros más firmes del campo.' },
  { id: 'vikingo', nombre: 'Guerrero', emoji: '🛡️', colorDefault: '#fa5252', desbloqueoTipo: 'puntos', puntosRequeridos: 400, descripcion: 'Imparable con su casco con cuernos.' },
  { id: 'copa', nombre: 'Elegante', emoji: '🎩', colorDefault: '#343a40', desbloqueoTipo: 'puntos', puntosRequeridos: 500, descripcion: 'Estilo impecable de alta etiqueta.' },
  { id: 'gorra', nombre: 'Campeón', emoji: '🧢', colorDefault: '#1971c2', desbloqueoTipo: 'puntos', puntosRequeridos: 600, descripcion: 'Velocidad callejera y reflejos rápidos.' },
  { id: 'boina', nombre: 'Artista', emoji: '🎨', colorDefault: '#ae3ec9', desbloqueoTipo: 'puntos', puntosRequeridos: 700, descripcion: 'Pinta las jugadas más inesperadas.' },
  { id: 'espacial', nombre: 'Astronauta', emoji: '👨‍🚀', colorDefault: '#0c8599', desbloqueoTipo: 'puntos', puntosRequeridos: 1000, descripcion: 'Explorador de los confines del tablero.' },
];

export interface Coordenada {
  r: number;
  c: number;
}

export interface EstadisticasJugador {
  acciones: number;
  movimientos: number;
  saltos: number;
  murosColocados: number;
  murosMaestros: number;
  usosPista: number;
  usosDeshacer: number;
  intentosMuroInvalido: number;
  turnosAgotados: number;
  maxDesventaja: number;
  remontada: boolean;
  partidaLimpia: boolean;
}

export interface JugadorEnJuego {
  id: number;
  cuentaId?: string;
  nombre: string;
  tipo: TipoDeJugador;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  r: number;
  c: number;
  muros: number;
  targetType: 'row' | 'col';
  targetValue: number;
  estadisticas: EstadisticasJugador;
}

export interface ConfigDePartida {
  numJugadores: 2 | 4;
  jugadores: {
    cuentaId?: string;
    nombre: string;
    tipo: TipoDeJugador;
    color: string;
    hat: AvatarTipoDeGorro;
    ropa?: AvatarTipoDeRopa;
    ropaColor?: string;
    aura?: AvatarTipoDeAura;
  }[];
  empiezaAlAzar: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  modoConTiempo: boolean;
  segundosPorTurno: number;
  esTorneo?: boolean;
  totalRondasTorneo?: number;
  tamanoTablero?: TamanoTablero;
  temaTablero?: TemaTablero;
  rotationMode?: boolean;
}

export interface AccionRegistro {
  id: string;
  turnoNumero: number;
  jugadorId: number;
  jugadorNombre: string;
  jugadorColor: string;
  tipo: 'mover' | 'muro' | 'salto' | 'tiempo';
  descripcion: string;
  detalle?: string;
  coordOrigen?: Coordenada;
  coordDestino?: Coordenada;
  orientacion?: OrientacionMuro;
  coordMuro?: Coordenada;
  esSalto?: boolean;
  esMuroMaestro?: boolean;
  tiempo?: string;
}

export interface InstantaneaJuego {
  jugadores: {
    id: number;
    tipo: TipoDeJugador;
    r: number;
    c: number;
    muros: number;
    estadisticas: EstadisticasJugador;
  }[];
  murosH: number[][];
  murosV: number[][];
  turnoActual: number;
  turnosTotales: number;
  registroAcciones: AccionRegistro[];
}

export interface RegistroRondaTorneo {
  ronda: number;
  ganadorId: number;
  ganadorNombre: string;
  puntosRonda: Record<number, number>;
}

export interface EstadoTorneo {
  activo: boolean;
  rondaActual: number;
  totalRondas: number;
  puntosAcumulados: Record<number, number>;
  victoriasAcumuladas: Record<number, number>;
  historialRondas: RegistroRondaTorneo[];
  terminado: boolean;
  ganadorGlobalId: number | null;
}

export type RolRedOnline = 'local' | 'host' | 'client';

export interface InfoJugadorOnline {
  id: number;
  peerId: string;
  cuentaId?: string;
  nombre: string;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  listo?: boolean;
  esAnfitrion: boolean;
  conectado: boolean;
}

export type MensajeOnline =
  | {
      type: 'JOIN_REQUEST';
      cuentaId?: string;
      nombre: string;
      color: string;
      hat: AvatarTipoDeGorro;
      ropa?: AvatarTipoDeRopa;
      ropaColor?: string;
      aura?: AvatarTipoDeAura;
    }
  | { type: 'JOIN_REJECTED'; motivo: string }
  | {
      type: 'LOBBY_UPDATE';
      roomCode: string;
      maxJugadores: 2 | 4;
      tamanoTablero?: TamanoTablero;
      jugadores: InfoJugadorOnline[];
    }
  | {
      type: 'START_GAME';
      config: ConfigDePartida;
      initialState: EstadoDeJuego;
      _startId?: string;
    }
  | {
      type: 'PLAYER_ACTION';
      jugadorId: number;
      accion: 'mover' | 'muro' | 'pasar';
      payload: {
        destino?: Coordenada;
        orientacion?: OrientacionMuro;
        r?: number;
        c?: number;
      };
      _actionId?: string;
    }
  | { type: 'STATE_SYNC'; state: EstadoDeJuego }
  | { type: 'REQUEST_SYNC'; jugadorId: number; turnosTotales?: number }
  | { type: 'REACTION'; jugadorId: number; emoji: string }
  | { type: 'REMATCH_REQUEST'; jugadorId: number; nombre?: string }
  | { type: 'REMATCH_RESPONSE'; jugadorId: number; nombre?: string; aceptada: boolean }
  | { type: 'PLAYER_LEFT'; jugadorId: number; nombre?: string }
  | { type: 'PING'; turnosTotales?: number; turnoActual?: number; terminada?: boolean }
  | { type: 'PONG'; turnosTotales?: number; turnoActual?: number; terminada?: boolean }
  | { type: 'DIAG_PING'; ts: number }
  | { type: 'DIAG_PONG'; ts: number }
  | { type: 'HOST_RESUMED'; state: EstadoDeJuego };

export interface SesionOnlineActiva {
  role: 'host' | 'client';
  roomCode: string;
  myPeerId?: string;
  hostPeerId?: string;
  myPlayerId?: number;
  myCuentaId?: string;
  myName: string;
  myColor: string;
  myHat: AvatarTipoDeGorro;
  myRopa?: AvatarTipoDeRopa;
  myRopaColor?: string;
  myAura?: AvatarTipoDeAura;
  tamanoTablero?: TamanoTablero;
  lastState?: EstadoDeJuego;
  timestamp: number;
}

export interface EstadoDeJuego {
  n: 2 | 4;
  tamanoTablero?: TamanoTablero;
  jugadores: JugadorEnJuego[];
  murosH: number[][];
  murosV: number[][];
  turnoActual: number;
  turnosTotales: number;
  terminada: boolean;
  ganador: number | null;
  modoAccion: 'mover' | 'muro';
  orientacionMuro: OrientacionMuro;
  muroPrevisualizado: {
    o: OrientacionMuro;
    r: number;
    c: number;
    validez: 'ok' | 'fuera' | 'solape' | 'bloquea';
  } | null;
  caminoPista: Coordenada[] | null;
  historial: InstantaneaJuego[];
  registroAcciones: AccionRegistro[];
  config: ConfigDePartida;
  tiempoRestante: number;
  pensandoBot: boolean;
  ultimoMensaje: string;
  torneo?: EstadoTorneo;
  modoOnline?: boolean;
  miJugadorId?: number;
  codigoSala?: string;
  esAnfitrion?: boolean;
  reaccionActiva?: { jugadorId: number; emoji: string; ts: number } | null;
}

export interface DesglosePuntos {
  resultado: number;
  murosUsados: number;
  finalCerrado: number;
  bonoDominacion?: number;
  bonoTorneo: number;
  ahorrador: number;
  rapidez: number;
  saltador: number;
  muroMaestro: number;
  remontada: number;
  racha: number;
  partidaLimpia: number;
  penalizaciones: {
    pistas: number;
    deshacer: number;
    murosInvalidos: number;
    tiempoAgotado: number;
    abandonar: number;
    total: number;
  };
  multiplicador: number;
  total: number;
}

export interface RegistroHistorialPartida {
  id: string;
  fecha: string;
  rival: string;
  resultado: 'victoria' | 'derrota' | 'empate';
  puntosGanados: number;
  movimientos: number;
  murosColocados: number;
  saltos: number;
  partidaLimpia?: boolean;
  modo: string;
  duracionSegundos?: number;
  logros?: string[];
}

export interface RegistroResultadoPartida {
  nombre: string;
  cuentaId?: string;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  gano: boolean;
  esBot: boolean;
  movimientos: number;
  murosColocados: number;
  saltos: number;
  partidaLimpia: boolean;
  puntosGanados: number;
  logrosDesbloqueados: string[];
  rivalNombre?: string;
}

export interface EntradaRanking {
  id?: string;
  nombre: string;
  puntosTotales: number;
  partidas: number;
  victorias: number;
  derrotas: number;
  empates?: number;
  rachaActual: number;
  mejorRacha: number;
  murosTotales: number;
  saltosTotales: number;
  partidasLimpias: number;
  logros: string[];
  ultimaPartida: string;
  avatarColor: string;
  avatarHat: AvatarTipoDeGorro;
  avatarRopa?: AvatarTipoDeRopa;
  avatarRopaColor?: string;
  avatarAura?: AvatarTipoDeAura;
}

export interface DefLogro {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

export type TemaTablero = 'madera' | 'neon' | 'hielo' | 'lava';

export interface AjustesDeApp {
  sonido: boolean;
  mostrarDistancia: boolean;
  mostrarCoordenadas: boolean;
  modoDaltonico: boolean;
  animacionesReducidas: boolean;
  permitirDeshacer: boolean;
  permitirPistas: boolean;
  temaTablero: TemaTablero;
  cambiarVistaPorTurno?: boolean;
}

export interface InfoNivel {
  nivel: number;
  titulo: string;
  icono: string;
  minPuntos: number;
  siguientePuntos: number | null;
}

export interface InfoSalaPublica {
  codigo: string;
  nombre: string;
  anfitrion: string;
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  maxJugadores: 2 | 4;
  jugadoresConectados: number;
  creadoEn: number;
  esOficialStaff?: boolean;
  modoMuros?: 'estandar' | 'tactico' | 'caos';
  tamanoTablero?: TamanoTablero;
}

export interface SolicitudResetRanking {
  solicitada: boolean;
  porNombre: string;
  porId: string;
  fecha: string;
  motivo?: string;
}

export interface UserCuenta {
  id: string;
  nombre: string;
  rol: UserRol;
  esSupremo?: boolean;
  clave?: string;
  avatarColor: string;
  avatarHat: AvatarTipoDeGorro;
  avatarRopa?: AvatarTipoDeRopa;
  avatarRopaColor?: string;
  avatarAura?: AvatarTipoDeAura;
  inventario?: UserInventario;
  puntos: number;
  partidas: number;
  victorias: number;
  derrotas?: number;
  empates?: number;
  logrosDesbloqueados: string[];
  temaTablero?: TemaTablero;
  historialPartidas?: RegistroHistorialPartida[];
  fechaRegistro: string;
  ultimaConexion: string;
}

export type PantallaApp =
  | 'menu'
  | 'config'
  | 'juego'
  | 'ranking'
  | 'logros'
  | 'como_jugar'
  | 'ajustes'
  | 'online_lobby';

export interface EntradaJugadorSemanal {
  id?: string;
  nombre: string;
  avatarColor: string;
  avatarHat: AvatarTipoDeGorro;
  avatarRopa?: AvatarTipoDeRopa;
  avatarRopaColor?: string;
  avatarAura?: AvatarTipoDeAura;
  puntos: number;
  victorias: number;
  partidas: number;
}

export interface DatosTableroSemanal {
  semanaId: string;
  cerrada?: boolean;
  premiados?: { nombre: string; puesto: number; bono: number; personajePremio?: AvatarColeccionable }[];
  premioSemanal?: AvatarColeccionable;
  puntosConfig?: {
    puntosVictoria?: number;
    puntosEmpate?: number;
    primerLugar: number;
    segundoLugar: number;
    tercerLugar: number;
    participacion?: number;
  };
  jugadores: Record<string, EntradaJugadorSemanal>;
}

export interface RespuestaRankingSemanal {
  ok: boolean;
  semanaActualId: string;
  semanaPasadaId: string;
  cierraEnMs: number;
  dbConectado?: boolean;
  actual: DatosTableroSemanal;
  pasada: DatosTableroSemanal;
}

export interface DatosDiagnosticoOnline {
  status: 'desconectado' | 'negociando' | 'conectado' | 'reconectando';
  pingMs: number | null;
  calidad: 'desconectado' | 'excelente' | 'buena' | 'inestable' | 'critica';
  miPeerId: string;
  rivalPeerId: string | null;
  role: 'none' | 'host' | 'client';
  iceState: string;
  dataChannelState: string;
  logs: { ts: string; tipo: 'info' | 'warn' | 'error'; mensaje: string }[];
}
