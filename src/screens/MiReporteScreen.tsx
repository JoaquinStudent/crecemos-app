// src/screens/MiReporteScreen.tsx
// "Mi reporte" (mock 06): la vista previa, como un documento, de lo que Freddy puede mostrarle a su
// banco, y el botón para compartirlo. Las señales y el texto salen del dominio (`senalesBanco`,
// `textoReporte`): la pantalla solo los dibuja. Nada sale del teléfono hasta que toca "Compartir
// reporte" (P6 de manejo-de-datos.md): generar esta vista no comparte nada.
// No entran del mock: el selector de periodo ni "Descargar PDF" (el periodo es fijo y se comparte
// texto plano).
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, CircleCheck, Lock, Share2 } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import {
  DIAS_CONVINCENTE,
  diasRegistradosTexto,
  senalesBanco,
  textoFaltan,
  textoReporte,
} from '@analisis/senales';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import type { MesCompleto, Senales } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { compartirReporte } from '@services/compartir';
import type { RootStackParamList } from '@navigation/RootStack';

const TEXTO_PRIVACIDAD =
  'Tú decides qué compartes. Este reporte muestra totales, no tus movimientos uno por uno. Nada se envía si no tocas el botón.';
const TEXTO_SIN_MES = 'aún no hay un mes completo';
const TEXTO_ERROR = 'No pudimos abrir la hoja para compartir. Inténtalo otra vez.';
const TEXTO_AYUDA_VACIO = 'Cierra tu primer día para armar tu reporte';

/** Alto de la zona de las barras: la del mes mayor la llena entera. */
const ALTO_BARRAS = 96;
/** La hoja se atenúa mientras el reporte está en construcción. */
const OPACIDAD_EN_CONSTRUCCION = 0.6;

// Alto de una barra respecto de la mayor: la mayor llega al 100 %.
const alto = (venta: number, mayor: number): `${number}%` =>
  `${mayor > 0 ? Math.max(0, Math.round((venta / mayor) * 100)) : 0}%`;

/** 'Jul', 'Ago', 'Sep': el mes en tres letras. */
const mesCorto = (m: MesCompleto): string => {
  const nombre = nombreMes(`${m.mes}-01`);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1, 3);
};

/** '28 de septiembre — 6 de octubre'; con un solo día, solo esa fecha. */
const rangoEnPalabras = (primero: string, ultimo: string): string =>
  primero === ultimo
    ? formatoFechaCorta(primero)
    : `${formatoFechaCorta(primero)} — ${formatoFechaCorta(ultimo)}`;

export const MiReporteScreen = () => {
  const { cierres, perfil } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'MiReporte'>>();
  const insets = useSafeAreaInsets();

  const senales = useMemo(() => senalesBanco(cierres, fechaLocal(new Date())), [cierres]);
  const texto = useMemo(() => textoReporte(senales, perfil), [senales, perfil]);

  const [falloAlCompartir, setFalloAlCompartir] = useState(false);
  // Un toque, una llamada: mientras la hoja se abre, otro toque no hace nada.
  const compartiendo = useRef(false);
  const sinDias = senales.diasRegistrados === 0;

  const compartir = async () => {
    if (compartiendo.current || sinDias) return;
    compartiendo.current = true;
    setFalloAlCompartir(false);
    try {
      const resultado = await compartirReporte(texto);
      // Cerrar la hoja sin compartir es `ok`: solo un fallo de verdad muestra el mensaje.
      setFalloAlCompartir(resultado?.ok === false);
    } catch {
      setFalloAlCompartir(true);
    } finally {
      compartiendo.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']} testID="reporte-pantalla">
      <ScrollView contentContainerStyle={styles.contenido}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          onPress={() => navigation.goBack()}
          style={styles.atras}
          testID="reporte-atras"
        >
          <Icon icon={ChevronLeft} color="primary" size="lg" />
          <Text variant="bodyStrong" color="primary">
            Atrás
          </Text>
        </Pressable>

        <View>
          <Text variant="h1" accessibilityRole="header">
            Mi reporte
          </Text>
          <Text variant="caption" color="textMuted">
            Para mostrarle a tu banco
          </Text>
        </View>

        {senales.enConstruccion ? <EnConstruccion senales={senales} /> : null}

        <View style={styles.privacidad} testID="reporte-aviso-privacidad">
          <Icon icon={Lock} color="primary" size="lg" />
          <Text
            variant="bodySmall"
            style={styles.privacidadTexto}
            testID="reporte-aviso-privacidad-texto"
          >
            {TEXTO_PRIVACIDAD}
          </Text>
        </View>

        <Hoja senales={senales} nombre={perfil.nombre} negocio={perfil.negocio} />
      </ScrollView>

      {/* El botón principal vive FUERA del scroll, en un pie fijo: siempre a la mano del pulgar. */}
      <View style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }]}>
        {sinDias ? (
          <Text variant="bodySmall" color="textMuted" align="center" testID="reporte-ayuda-vacio">
            {TEXTO_AYUDA_VACIO}
          </Text>
        ) : null}
        {falloAlCompartir ? (
          <Text
            variant="bodySmall"
            color="danger"
            align="center"
            accessibilityLiveRegion="polite"
            testID="reporte-error-compartir"
          >
            {TEXTO_ERROR}
          </Text>
        ) : null}
        <Button
          title="Compartir reporte"
          leftIcon={Share2}
          size="lg"
          fullWidth
          disabled={sinDias}
          onPress={compartir}
          testID="reporte-compartir"
        />
      </View>
    </SafeAreaView>
  );
};

/** Aviso de que aún faltan días, con una barra de progreso: el naranja es solo el relleno. */
const EnConstruccion = ({ senales }: { senales: Senales }) => {
  const registrados = DIAS_CONVINCENTE - senales.diasFaltantes;
  const progreso = Math.min(100, Math.max(0, Math.round((registrados / DIAS_CONVINCENTE) * 100)));
  return (
    <View style={styles.construccion} testID="reporte-en-construccion">
      <Text variant="bodyStrong" testID="reporte-faltan">
        {textoFaltan(senales.diasFaltantes)}
      </Text>
      <View
        style={styles.pista}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: DIAS_CONVINCENTE, now: registrados }}
        testID="reporte-progreso"
      >
        <View
          style={[styles.relleno, { width: `${progreso}%` }]}
          testID="reporte-progreso-relleno"
        />
      </View>
    </View>
  );
};

/** La vista previa como un documento: lo mismo que viaja en el texto, en una hoja blanca. */
const Hoja = ({
  senales,
  nombre,
  negocio,
}: {
  senales: Senales;
  nombre: string;
  negocio: string;
}) => {
  const quien = [nombre, negocio]
    .map(parte => parte.trim())
    .filter(parte => parte !== '')
    .join(' · ');
  const { primerCierre, ultimoCierre } = senales;
  const hayDias = primerCierre !== undefined && ultimoCierre !== undefined;
  const hayMeses = senales.mesesCompletos > 0;

  return (
    <View
      style={[styles.hoja, senales.enConstruccion && styles.hojaAtenuada]}
      testID="reporte-hoja"
    >
      <Text variant="label" color="primary" style={styles.marca}>
        Crecemos
      </Text>
      <Text variant="bodyStrong">Reporte de actividad del negocio</Text>
      {quien !== '' ? (
        <Text variant="bodySmall" testID="reporte-quien">
          {quien}
        </Text>
      ) : null}
      <Text variant="caption" color="textMuted" testID="reporte-periodo">
        {hayDias
          ? `${rangoEnPalabras(primerCierre, ultimoCierre)} · ${diasRegistradosTexto(
              senales.diasRegistrados,
            )}`
          : 'Todavía no hay días registrados'}
      </Text>

      <View style={styles.linea} />

      <FilaDato
        etiqueta="Venta promedio mensual"
        valor={hayMeses ? formatoSoles(senales.ventaPromedioMensual) : TEXTO_SIN_MES}
        testID="reporte-venta-promedio"
      />
      <FilaDato
        etiqueta="Ganancia promedio mensual"
        valor={hayMeses ? formatoSoles(senales.gananciaPromedioMensual) : TEXTO_SIN_MES}
        testID="reporte-ganancia-promedio"
      />
      {/* Ningún porcentaje va solo: la constancia siempre lleva sus días al lado. */}
      <FilaDato
        etiqueta="Constancia de registro"
        valor={`${senales.constancia} % · ${diasRegistradosTexto(senales.diasRegistrados)}`}
        testID="reporte-constancia"
      />

      {hayMeses ? <Barras meses={senales.meses} /> : null}

      {hayDias ? (
        <View style={styles.pieHoja}>
          <Icon icon={CircleCheck} color="success" size="lg" />
          <Text variant="bodySmall" style={styles.pieTexto} testID="reporte-pie">
            {senales.diasRegistrados === 1
              ? `1 cierre de día registrado el ${formatoFechaCorta(primerCierre)}`
              : `${senales.diasRegistrados} cierres de día registrados entre el ${formatoFechaCorta(
                  primerCierre,
                )} y el ${formatoFechaCorta(ultimoCierre)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const FilaDato = ({
  etiqueta,
  valor,
  testID,
}: {
  etiqueta: string;
  valor: string;
  testID: string;
}) => (
  <View style={styles.filaDato}>
    <Text variant="bodySmall" color="textMuted" style={styles.etiquetaDato}>
      {etiqueta}
    </Text>
    <Text variant="bodyStrong" align="right" style={styles.valorDato} testID={testID}>
      {valor}
    </Text>
  </View>
);

/** Una barra por mes completo: el monto encima, el mes debajo, el mayor llena la zona. */
const Barras = ({ meses }: { meses: MesCompleto[] }) => {
  const mayor = Math.max(...meses.map(m => m.venta));
  return (
    <View style={styles.barras} testID="reporte-barras">
      {meses.map(m => (
        <View key={m.mes} style={styles.columna}>
          <Text
            variant="caption"
            style={styles.monto}
            align="center"
            testID={`reporte-monto-${m.mes}`}
          >
            {formatoSoles(m.venta)}
          </Text>
          <View style={styles.zonaBarra}>
            <View
              style={[styles.barra, { height: alto(m.venta, mayor) }]}
              testID={`reporte-barra-${m.mes}`}
            />
          </View>
          <Text variant="caption" color="textMuted" testID={`reporte-mes-${m.mes}`}>
            {mesCorto(m)}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  atras: {
    alignSelf: 'flex-start',
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  construccion: {
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pista: {
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  // El naranja es solo relleno: las letras del aviso van en oscuro.
  relleno: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent },
  privacidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  privacidadTexto: { flex: 1 },
  hoja: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  hojaAtenuada: { opacity: OPACIDAD_EN_CONSTRUCCION },
  marca: { fontWeight: '700', letterSpacing: 0.5 },
  linea: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  etiquetaDato: { flex: 1 },
  valorDato: { flexShrink: 1, maxWidth: '58%' },
  barras: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  columna: { flex: 1, alignItems: 'center', gap: spacing.xs },
  monto: { fontWeight: '600' },
  zonaBarra: { height: ALTO_BARRAS, width: 40, justifyContent: 'flex-end' },
  barra: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  pieHoja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pieTexto: { flex: 1 },
  pie: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
