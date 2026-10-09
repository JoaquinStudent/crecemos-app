// src/screens/MiReporteScreen.tsx
// "Mi reporte" (mock 06): la vista previa, como un documento, de lo que Freddy puede mostrarle a su
// banco, y los botones para compartirlo. Las señales, el texto y el documento salen del dominio
// (`senalesBanco`, `textoReporte`, `htmlReporte`): la pantalla solo los dibuja. Nada se genera ni
// sale del teléfono hasta que toca un botón (P6 de manejo-de-datos.md): "Compartir reporte" arma el
// PDF en el teléfono y abre la hoja de compartir; "Compartir solo el texto" comparte texto plano.
// No entra del mock el selector de periodo (el periodo es fijo).
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
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { htmlReporte, NOMBRE_ARCHIVO_PDF } from '@analisis/htmlReporte';
import {
  DIAS_CONVINCENTE,
  diasRegistradosTexto,
  senalesBanco,
  textoFaltan,
  textoReporte,
} from '@analisis/senales';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import { avatarDe } from '@dominio/foto';
import type { MesCompleto, Perfil, Senales } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { compartirReporte } from '@services/compartir';
import { compartirPdf } from '@services/pdf';
import type { RootStackParamList } from '@navigation/RootStack';

const TEXTO_PRIVACIDAD =
  'Tú decides qué compartes. Este reporte muestra totales, no tus movimientos uno por uno. Nada se envía si no tocas el botón.';
const TEXTO_SIN_MES = 'aún no hay un mes completo';
const TEXTO_ERROR = 'No pudimos abrir la hoja para compartir. Inténtalo otra vez.';
const TEXTO_ERROR_PDF = 'No pudimos preparar el PDF. Inténtalo otra vez.';
const TEXTO_AYUDA_VACIO = 'Cierra tu primer día para armar tu reporte';
const TEXTO_AYUDA_PDF = 'El PDF lleva solo totales. No lleva tu Yape ni tus movimientos.';
const TITULO_PDF = 'Reporte de actividad del negocio';
/** Foto de la identidad en la hoja de pantalla, en dp. */
const TAMANO_FOTO = 56;

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

  const { senales, hoy } = useMemo(() => {
    const fecha = fechaLocal(new Date());
    return { senales: senalesBanco(cierres, fecha), hoy: fecha };
  }, [cierres]);
  const texto = useMemo(() => textoReporte(senales, perfil), [senales, perfil]);

  // El mensaje amable del último fallo (o nada). Cerrar la hoja sin compartir no es un fallo.
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  // Un toque, una acción: mientras se prepara o se abre la hoja, otro toque no hace nada.
  const ocupado = useRef(false);
  const sinDias = senales.diasRegistrados === 0;

  const compartirComoPdf = async () => {
    if (ocupado.current || sinDias) return;
    ocupado.current = true;
    setMensajeError(null);
    setPreparando(true);
    try {
      // El documento se arma aquí, al tocar: abrir la pantalla no genera ni comparte nada.
      const resultado = await compartirPdf(
        htmlReporte(senales, perfil, hoy),
        NOMBRE_ARCHIVO_PDF(hoy),
        TITULO_PDF,
      );
      setMensajeError(
        resultado?.ok !== false
          ? null
          : resultado.error === 'NO_SE_PUDO_PREPARAR'
          ? TEXTO_ERROR_PDF
          : TEXTO_ERROR,
      );
    } catch {
      setMensajeError(TEXTO_ERROR_PDF);
    } finally {
      ocupado.current = false;
      setPreparando(false);
    }
  };

  const compartirComoTexto = async () => {
    if (ocupado.current || sinDias) return;
    ocupado.current = true;
    setMensajeError(null);
    try {
      const resultado = await compartirReporte(texto);
      // Cerrar la hoja sin compartir es `ok`: solo un fallo de verdad muestra el mensaje.
      setMensajeError(resultado?.ok === false ? TEXTO_ERROR : null);
    } catch {
      setMensajeError(TEXTO_ERROR);
    } finally {
      ocupado.current = false;
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

        <Hoja senales={senales} perfil={perfil} />
      </ScrollView>

      {/* Los botones viven FUERA del scroll, en un pie fijo: siempre a la mano del pulgar. */}
      <View style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }]}>
        {sinDias ? (
          <Text variant="bodySmall" color="textMuted" align="center" testID="reporte-ayuda-vacio">
            {TEXTO_AYUDA_VACIO}
          </Text>
        ) : null}
        {mensajeError !== null ? (
          <Text
            variant="bodySmall"
            color="danger"
            align="center"
            accessibilityLiveRegion="polite"
            testID="reporte-error-compartir"
          >
            {mensajeError}
          </Text>
        ) : null}
        <Button
          title={preparando ? 'Preparando tu reporte…' : 'Compartir reporte'}
          leftIcon={Share2}
          size="lg"
          fullWidth
          disabled={sinDias || preparando}
          onPress={compartirComoPdf}
          testID="reporte-compartir-pdf"
        />
        <Button
          title="Compartir solo el texto"
          variant="outline"
          size="md"
          fullWidth
          disabled={sinDias || preparando}
          onPress={compartirComoTexto}
          testID="reporte-compartir"
        />
        <Text variant="caption" color="textMuted" align="center" testID="reporte-ayuda-pdf">
          {TEXTO_AYUDA_PDF}
        </Text>
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
const Hoja = ({ senales, perfil }: { senales: Senales; perfil: Perfil }) => {
  const quien = [perfil.nombre, perfil.negocio]
    .map(parte => parte.trim())
    .filter(parte => parte !== '')
    .join(' · ');
  // Solo hay círculo si hay foto: la inicial no aporta nada a un documento.
  const conFoto = avatarDe(perfil).tipo === 'foto';
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
      {quien !== '' || conFoto ? (
        <View style={styles.identidad}>
          {conFoto ? (
            <AvatarPerfil perfil={perfil} tamano={TAMANO_FOTO} testIDFoto="reporte-avatar-foto" />
          ) : null}
          {quien !== '' ? (
            <Text variant="bodySmall" style={styles.quien} testID="reporte-quien">
              {quien}
            </Text>
          ) : null}
        </View>
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
        etiqueta="Resultado registrado promedio mensual"
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
  identidad: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quien: { flex: 1 },
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
