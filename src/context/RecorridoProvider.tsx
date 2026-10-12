// src/context/RecorridoProvider.tsx
// El recorrido guiado de primera vez. Aquí vive el ESTADO y la lógica (qué pasos hay, en cuál va,
// cuándo arranca, qué se guarda); el dibujo es `RecorridoOverlay`, y lo que las pantallas usan es
// `PasoGuia` + `useRecorrido()`. Nadie fuera de estos tres depende de cómo se dibuja.
//
// Reglas: nada avanza solo (solo botones); Saltar, Entendido o el botón Atrás del teléfono en el
// primer paso lo cierran Y lo marcan como visto (no se insiste); un paso cuyo pedazo de pantalla
// no está montado se salta; mientras corre, lo de abajo queda oculto al lector de pantalla.
import React, {
  createContext,
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecorridoOverlay } from '@components/organisms/RecorridoOverlay';
import type { Rect } from '@components/molecules/PasoGuia';
import {
  marcarRecorridoVisto,
  olvidarRecorridoVisto,
  recorridoVisto,
} from '@storage/repositorio';

/** Un paso tal como lo registra `PasoGuia` al montarse. */
export interface PasoRegistro {
  nombre: string;
  orden: number;
  titulo: string;
  texto: string;
  /** Dónde está ahora en la ventana; `null` si ya no está o no tiene tamaño. */
  medir: () => Promise<Rect | null>;
  /** Si vive dentro de un scroll: lo mueve `dy` puntos para acercarlo. */
  traerAVista?: (dy: number) => Promise<void>;
}

type Fase = 'inactivo' | 'pendiente' | 'arrancando' | 'activo';

interface RecorridoContexto {
  registrar: (paso: PasoRegistro) => () => void;
  fase: Fase;
  iniciar: () => void;
  repetir: () => Promise<void>;
  comenzar: () => Promise<void>;
  autoRevisado: MutableRefObject<boolean>;
}

const sinEfecto = () => undefined;
const contextoVacio: RecorridoContexto = {
  registrar: () => sinEfecto,
  fase: 'inactivo',
  iniciar: sinEfecto,
  repetir: () => Promise.resolve(),
  comenzar: () => Promise.resolve(),
  autoRevisado: { current: true },
};

const RecorridoContext = createContext<RecorridoContexto>(contextoVacio);

/** Cuánto arriba queda lo señalado cuando hay que desplazar hasta traerlo. */
const POSICION_AL_TRAER = 96;
/** Reserva abajo para la barra de navegación (un paso que queda tapado por ella no está a la vista). */
const RESERVA_BARRA = 100;

const estaALaVista = (r: Rect, alto: number, tope: number) =>
  r.y >= tope && r.y + r.height <= alto - RESERVA_BARRA;

export const RecorridoProvider = ({ children }: { children: ReactNode }) => {
  const registro = useRef(new Map<string, PasoRegistro>());
  const faseRef = useRef<Fase>('inactivo');
  const token = useRef(0);
  const autoRevisado = useRef(false);
  const lista = useRef<PasoRegistro[]>([]);
  const [fase, setFaseEstado] = useState<Fase>('inactivo');
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [total, setTotal] = useState(0);
  const { height: alto } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const altoRef = useRef(alto);
  altoRef.current = alto;
  const topeRef = useRef(insets.top);
  topeRef.current = insets.top;
  const indiceRef = useRef(0);
  indiceRef.current = indice;

  const setFase = useCallback((nueva: Fase) => {
    faseRef.current = nueva;
    setFaseEstado(nueva);
  }, []);

  const registrar = useCallback((paso: PasoRegistro) => {
    registro.current.set(paso.nombre, paso);
    return () => {
      // Si ya hay otro registrado con ese nombre, no lo borres.
      if (registro.current.get(paso.nombre) === paso) registro.current.delete(paso.nombre);
    };
  }, []);

  const cerrar = useCallback(() => {
    token.current += 1;
    setRect(null);
    setFase('inactivo');
    // Visto es visto: si no se pudo guardar, la próxima vez se ofrece de nuevo (y nada se rompe).
    marcarRecorridoVisto().catch(() => undefined);
  }, [setFase]);

  /** Muestra el paso `desde` (o el siguiente que se pueda medir en esa dirección). */
  const mostrar = useCallback(
    async (desde: number, direccion: 1 | -1): Promise<'ok' | 'agotado' | 'cancelado'> => {
      const miToken = ++token.current;
      for (let i = desde; i >= 0 && i < lista.current.length; i += direccion) {
        const paso = lista.current[i];
        let medida = await paso.medir();
        if (miToken !== token.current) return 'cancelado';
        if (medida && paso.traerAVista && !estaALaVista(medida, altoRef.current, topeRef.current)) {
          await paso.traerAVista(medida.y - POSICION_AL_TRAER);
          if (miToken !== token.current) return 'cancelado';
          medida = (await paso.medir()) ?? medida;
          if (miToken !== token.current) return 'cancelado';
        }
        if (medida) {
          setIndice(i);
          setRect(medida);
          setFase('activo');
          return 'ok';
        }
      }
      return 'agotado';
    },
    [setFase],
  );

  const comenzar = useCallback(async () => {
    if (faseRef.current !== 'pendiente') return;
    setFase('arrancando');
    const candidatos = [...registro.current.values()].sort((a, b) => a.orden - b.orden);
    const medidos = await Promise.all(candidatos.map(async p => ((await p.medir()) ? p : null)));
    const montados = medidos.filter((p): p is PasoRegistro => p !== null);
    if (montados.length === 0) {
      // Nada que mostrar todavía: no se marca como visto, se reintenta en otro arranque.
      setFase('inactivo');
      return;
    }
    lista.current = montados;
    setTotal(montados.length);
    const resultado = await mostrar(0, 1);
    if (resultado === 'agotado') setFase('inactivo');
  }, [mostrar, setFase]);

  const iniciar = useCallback(() => {
    if (faseRef.current === 'inactivo') setFase('pendiente');
  }, [setFase]);

  const repetir = useCallback(async () => {
    await olvidarRecorridoVisto();
    iniciar();
  }, [iniciar]);

  const siguiente = useCallback(async () => {
    const resultado = await mostrar(indiceRef.current + 1, 1);
    if (resultado === 'agotado') cerrar();
  }, [cerrar, mostrar]);

  const atras = useCallback(async () => {
    if (indiceRef.current === 0) {
      cerrar();
      return;
    }
    const resultado = await mostrar(indiceRef.current - 1, -1);
    if (resultado === 'agotado') cerrar();
  }, [cerrar, mostrar]);

  // El botón Atrás del teléfono nunca se bloquea: vuelve un paso, o cierra en el primero.
  useEffect(() => {
    if (fase !== 'activo') return undefined;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      atras();
      return true;
    });
    return () => suscripcion.remove();
  }, [fase, atras]);

  const valor = useMemo<RecorridoContexto>(
    () => ({ registrar, fase, iniciar, repetir, comenzar, autoRevisado }),
    [registrar, fase, iniciar, repetir, comenzar],
  );

  const activo = fase === 'activo' && rect !== null;
  const paso = lista.current[indice];

  return (
    <RecorridoContext.Provider value={valor}>
      <View style={styles.raiz}>
        <View
          style={styles.raiz}
          importantForAccessibility={activo ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={activo}
        >
          {children}
        </View>
        {activo && paso ? (
          <RecorridoOverlay
            rect={rect}
            indice={indice}
            total={total}
            titulo={paso.titulo}
            texto={paso.texto}
            alSiguiente={siguiente}
            alAtras={atras}
            alSaltar={cerrar}
          />
        ) : null}
      </View>
    </RecorridoContext.Provider>
  );
};

const styles = StyleSheet.create({ raiz: { flex: 1 } });

/** Para `PasoGuia`: cómo registrarse. */
export const useRegistroDePasos = () => useContext(RecorridoContext).registrar;

/** Lo que usan las pantallas: arrancar el recorrido, repetirlo y saber si está en marcha. */
export const useRecorrido = () => {
  const { fase, iniciar, repetir } = useContext(RecorridoContext);
  return { activo: fase !== 'inactivo', iniciar, repetir };
};

/**
 * Para Inicio: arranca solo UNA vez (primer uso) cuando `listo` (Inicio enfocado, datos cargados,
 * sin error), y también cuando alguien lo pidió desde otro lado (`repetir`). Si no se puede
 * saber si ya lo vio, no lo muestra.
 */
export const useRecorridoAutomatico = (listo: boolean) => {
  const { fase, iniciar, comenzar, autoRevisado } = useContext(RecorridoContext);

  useEffect(() => {
    if (!listo || autoRevisado.current || fase !== 'inactivo') return undefined;
    autoRevisado.current = true;
    let vivo = true;
    let respondio = false;
    recorridoVisto()
      .then(visto => {
        respondio = true;
        if (vivo && !visto) iniciar();
      })
      .catch(() => {
        respondio = true;
      });
    return () => {
      vivo = false;
      // Se canceló antes de saber la respuesta: la próxima oportunidad vuelve a preguntar.
      if (!respondio) autoRevisado.current = false;
    };
  }, [listo, fase, iniciar, autoRevisado]);

  useEffect(() => {
    if (listo && fase === 'pendiente') comenzar().catch(() => undefined);
  }, [listo, fase, comenzar]);
};
