// src/screens/MisReportesScreen.tsx
// "Mis reportes": los enlaces de reporte que la persona decidió guardar (con el título que ella eligió). Cada
// tarjeta dice el título, el periodo, cuándo se creó y si el enlace sigue vigente (con los días que quedan) o
// caducó; la palabra manda, el estilo solo acompaña. Al tocarla se abre el detalle con el QR, el código, el
// enlace y los botones. Nada se sube ni se borra al abrir la pantalla: "Borrar de la nube" pide confirmación y
// usa el token que solo vive en el teléfono; "Quitar de mi lista" solo olvida la entrada (el archivo en la nube
// sigue hasta que caduque, y la pantalla lo dice).
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircleCheck, Clock } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Card } from '@components/molecules/Card';
import { EmptyState } from '@components/molecules/EmptyState';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { DetalleEnlaceReporte } from '@components/organisms/DetalleEnlaceReporte';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { FILTRO_TODO, type FiltroPeriodo } from '@analisis/periodo';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta } from '@dominio/formato';
import { diasQueQuedan, estaVigente, type EntradaReporte } from '@dominio/reporteGuardado';
import { borrarDeLaNube } from '@services/reporteNube';
import { TEXTO_SIN_INTERNET } from '@services/jev';
import { listarReportesGuardados, quitarReporteDeLista } from '@storage/repositorio';
import { JEV_URL } from '../config';
import type { RootStackParamList } from '@navigation/RootStack';

export const TEXTO_SIN_REPORTES =
  'Aún no guardaste reportes. Crea un enlace en Mi reporte y guárdalo aquí.';
const TEXTO_NO_BORRADO = 'No pudimos borrarlo ahora. Inténtalo más tarde.';
const TEXTO_MUCHAS_PETICIONES = 'Hay muchas peticiones ahora. Prueba en un minuto.';
const TEXTO_BORRADO = 'Se borró de la nube. El enlace ya no funciona.';

/** Un filtro guardado, validado: si algo no cuadra se vuelve a «todo el historial». */
export const filtroDeEntrada = (e: EntradaReporte): FiltroPeriodo => {
  const f = e.filtro as Partial<Record<string, unknown>> | null;
  switch (f?.tipo) {
    case 'esteMes':
    case 'mesPasado':
    case 'ultimos30':
      return { tipo: f.tipo };
    case 'mes':
      return typeof f.mes === 'string' ? { tipo: 'mes', mes: f.mes } : FILTRO_TODO;
    case 'rango':
      return typeof f.desde === 'string' && typeof f.hasta === 'string'
        ? { tipo: 'rango', desde: f.desde, hasta: f.hasta }
        : FILTRO_TODO;
    default:
      return FILTRO_TODO;
  }
};

const fechaDe = (iso: string): string => formatoFechaCorta(fechaLocal(new Date(iso)));

/** «Vigente · quedan 12 días» o «Caducó el 3 de octubre»: siempre en palabras. */
export const estadoEnPalabras = (e: EntradaReporte, ahora: number): string => {
  if (!estaVigente(e, ahora)) return `Caducó el ${fechaDe(e.caduca)}`;
  const dias = diasQueQuedan(e.caduca, ahora);
  return `Vigente · ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}`;
};

export const MisReportesScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'MisReportes'>>();
  const [reportes, setReportes] = useState<EntradaReporte[] | null>(null);
  const [abierto, setAbierto] = useState<EntradaReporte | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Un solo candado para borrar: un segundo toque mientras corre no hace nada.
  const ocupado = useRef(false);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setReportes(await listarReportesGuardados());
  }, []);
  // Al entrar (y al volver) solo se lee el teléfono: ninguna petición.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const ahora = Date.now();

  const quitar = async () => {
    if (!abierto) return;
    await quitarReporteDeLista(abierto.clave);
    setAbierto(null);
    setAviso(null);
    await cargar();
  };

  const borrarDeLaNubeAhora = async () => {
    if (!abierto || ocupado.current) return;
    ocupado.current = true;
    setBorrando(true);
    try {
      const r = await borrarDeLaNube(abierto, globalThis.fetch, JEV_URL);
      setConfirmandoBorrado(false);
      if (r.ok) {
        setAbierto(null);
        setAviso(TEXTO_BORRADO);
        await cargar();
      } else {
        // Nada se pierde: la entrada sigue en la lista para reintentar.
        setAviso(
          r.error === 'SIN_RED' || r.error === 'TIEMPO_AGOTADO'
            ? TEXTO_SIN_INTERNET
            : r.error === 'LIMITE'
            ? TEXTO_MUCHAS_PETICIONES
            : TEXTO_NO_BORRADO,
        );
      }
    } finally {
      ocupado.current = false;
      setBorrando(false);
    }
  };

  const crearNuevo = () => {
    if (!abierto) return;
    const filtro = filtroDeEntrada(abierto);
    setAbierto(null);
    // `push` abre Mi reporte con ese periodo ya elegido (aunque haya otro Mi reporte debajo).
    navigation.push('MiReporte', { filtro });
  };

  const vigente = abierto !== null && estaVigente(abierto, ahora);

  return (
    <PantallaPerfilSeccion
      title="Mis reportes"
      subtitle="Los enlaces que guardaste"
      onBack={() => navigation.goBack()}
      testID="mis-reportes"
    >
      {aviso !== null ? (
        <Text variant="bodyStrong" accessibilityLiveRegion="polite" testID="mis-reportes-aviso">
          {aviso}
        </Text>
      ) : null}
      {reportes !== null && reportes.length === 0 ? (
        <EmptyState title="Mis reportes" text={TEXTO_SIN_REPORTES} testID="mis-reportes-vacio" />
      ) : null}
      {(reportes ?? []).map(e => {
        const vive = estaVigente(e, ahora);
        return (
          <Pressable
            key={e.clave}
            onPress={() => {
              setAviso(null);
              setAbierto(e);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${e.titulo ?? 'Reporte'}. ${e.periodoEtiqueta}. ${estadoEnPalabras(
              e,
              ahora,
            )}. Toca para ver el enlace.`}
            style={styles.tarjeta}
            testID={`mis-reportes-tarjeta-${e.id}`}
          >
            <Card variant="bordered" wrapperStyle={styles.contenidoTarjeta}>
              <Text variant="bodyStrong" testID={`mis-reportes-titulo-${e.id}`}>
                {e.titulo}
              </Text>
              <Text variant="bodySmall" color="textMuted">
                {e.periodoEtiqueta}
              </Text>
              <Text variant="bodySmall" color="textMuted">
                {`Creado el ${fechaDe(e.creadoEn)}`}
              </Text>
              <View style={styles.estado}>
                <Icon
                  icon={vive ? CircleCheck : Clock}
                  color={vive ? 'success' : 'textMuted'}
                  size="md"
                />
                <Text variant="bodyStrong" testID={`mis-reportes-estado-${e.id}`}>
                  {estadoEnPalabras(e, ahora)}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <BottomSheet
        visible={abierto !== null}
        onClose={() => setAbierto(null)}
        accessibilityLabel="Detalle del reporte guardado"
        testID="mis-reportes-detalle"
        footer={
          <Button
            title="Listo"
            size="lg"
            fullWidth
            onPress={() => setAbierto(null)}
            testID="mis-reportes-listo"
          />
        }
      >
        {abierto !== null ? (
          <View style={styles.detalle}>
            <Text variant="h3" testID="mis-reportes-detalle-titulo">
              {abierto.titulo}
            </Text>
            <Text variant="bodySmall" color="textMuted">
              {`${abierto.periodoEtiqueta} · Creado el ${fechaDe(abierto.creadoEn)}`}
            </Text>
            <Text variant="bodyStrong" testID="mis-reportes-detalle-estado">
              {estadoEnPalabras(abierto, ahora)}
            </Text>
            <DetalleEnlaceReporte
              id={abierto.id}
              url={abierto.url}
              caduca={abierto.caduca}
              vigente={vigente}
              prefijo="mis-reportes-enlace"
            />
            {vigente ? (
              <Button
                title="Borrar de la nube"
                variant="danger"
                fullWidth
                onPress={() => setConfirmandoBorrado(true)}
                testID="mis-reportes-borrar"
              />
            ) : (
              <Button
                title="Crear enlace nuevo"
                fullWidth
                onPress={crearNuevo}
                testID="mis-reportes-nuevo"
              />
            )}
            <Button
              title="Quitar de mi lista"
              variant="ghost"
              fullWidth
              onPress={quitar}
              testID="mis-reportes-quitar"
            />
            <Text variant="caption" color="textMuted" testID="mis-reportes-quitar-ayuda">
              {vigente
                ? `Solo la quita de esta lista. El archivo en la nube sigue hasta que caduque el ${fechaDe(
                    abierto.caduca,
                  )}; para que deje de funcionar antes, usa «Borrar de la nube».`
                : 'Solo la quita de esta lista.'}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={confirmandoBorrado && abierto !== null}
        onClose={() => setConfirmandoBorrado(false)}
        accessibilityLabel="Confirmar el borrado en la nube"
        testID="mis-reportes-confirmar"
        footer={
          <>
            <Button
              title={borrando ? 'Borrando…' : 'Sí, borrar de la nube'}
              variant="danger"
              size="lg"
              fullWidth
              disabled={borrando}
              onPress={borrarDeLaNubeAhora}
              testID="mis-reportes-confirmar-si"
            />
            <Button
              title="No, dejarlo"
              variant="ghost"
              fullWidth
              onPress={() => setConfirmandoBorrado(false)}
              testID="mis-reportes-confirmar-no"
            />
          </>
        }
      >
        <Text variant="h3">¿Borrar de la nube?</Text>
        <Text testID="mis-reportes-confirmar-texto">
          {`Dejará de funcionar el enlace y el QR del reporte «${abierto?.titulo ?? ''}». ¿Borrar?`}
        </Text>
      </BottomSheet>
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  tarjeta: { minHeight: 48 },
  contenidoTarjeta: { gap: spacing.xs },
  estado: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  detalle: { gap: spacing.md, alignItems: 'stretch' },
});
