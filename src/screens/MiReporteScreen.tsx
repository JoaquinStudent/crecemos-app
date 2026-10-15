// src/screens/MiReporteScreen.tsx
// "Mi reporte" (mock 06): la vista previa, como un documento, de lo que Freddy puede mostrarle a su
// banco, y los botones para compartirlo. Las señales, el texto y el documento salen del dominio
// (`senalesBanco`, `textoReporte`, `htmlReporte`): la pantalla solo los dibuja. Nada se genera ni
// sale del teléfono hasta que toca un botón (P6 de manejo-de-datos.md): "Compartir reporte" arma el
// PDF en el teléfono y abre la hoja de compartir; "Compartir solo el texto" comparte texto plano.
// Sprint-15: el periodo ya se puede elegir (por defecto, todo el historial hasta hoy) y el reporte se
// puede compartir siempre que haya al menos un cierre en el periodo: ya no espera al fin de mes. La
// hoja del banco de siempre va primero; debajo, la inteligencia de negocio del periodo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircleCheck, FolderOpen, Link2, Lock, Share2 } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Icon } from '@components/atoms/Icon';
import { ProgressBar } from '@components/atoms/ProgressBar';
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { Callout } from '@components/molecules/Callout';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { CodigoQR } from '@components/molecules/CodigoQR';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { DetalleEnlaceReporte } from '@components/organisms/DetalleEnlaceReporte';
import { InteligenciaReporte } from '@components/organisms/InteligenciaReporte';
import { SelectorPeriodo } from '@components/organisms/SelectorPeriodo';
import { claveDelReporte } from '@analisis/claveReporte';
import { htmlReporte, NOMBRE_ARCHIVO_PDF } from '@analisis/htmlReporte';
import {
  AVISO_EJEMPLO_SECCION,
  AVISO_SIN_ENLACE,
  codigoDeEnlace,
  construirPasaporte,
  explicacionCuota,
  modulosQR,
  textoCaduca,
  NOTA_CODIGO,
  NOTA_CUOTA,
  SIN_CONSTANCIA_MES,
  textoCuota,
  TITULO_CODIGO,
  TITULO_CUOTA,
  type Pasaporte,
} from '@analisis/pasaporte';
import {
  DIAS_CONVINCENTE,
  diasRegistradosTexto,
  AVISO_EJEMPLO,
  cierresDelReporte,
  textoFaltan,
  textoReporte,
} from '@analisis/senales';
import {
  FILTRO_TODO,
  mesesConCierres,
  puedeEmitirReporte,
  type FiltroPeriodo,
} from '@analisis/periodo';
import { datosDelReporte } from '@analisis/reporteDelPeriodo';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import { avatarDe } from '@dominio/foto';
import type { MesCompleto, Perfil, Senales } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { compartirReporte } from '@services/compartir';
import { compartirPdf } from '@services/pdf';
import {
  creacionEnCurso,
  crearEnlaceReporte,
  enlaceDe,
  entradaVigente,
  type ResultadoCrearEnlace,
} from '@services/reporteNube';
import { DIAS_ENLACE_REPORTE, TEXTO_SIN_INTERNET, type EnlaceReporte } from '@services/jev';
import { JEV_URL } from '../config';
import { guardarReporteEnLista, type ResultadoGuardarReporte } from '@storage/repositorio';
import {
  MAX_REPORTES_GUARDADOS,
  MAX_TITULO,
  tituloSugerido,
  type EntradaReporte,
} from '@dominio/reporteGuardado';
import type { RootStackParamList } from '@navigation/RootStack';

const TEXTO_PRIVACIDAD =
  'Tú decides qué compartes. Este reporte muestra totales, no tus movimientos uno por uno. Nada se envía si no tocas el botón.';
const TEXTO_SIN_MES = 'aún no hay un mes completo';
const TEXTO_ERROR = 'No pudimos abrir la hoja para compartir. Inténtalo otra vez.';
const TEXTO_ERROR_PDF = 'No pudimos preparar el PDF. Inténtalo otra vez.';
const TEXTO_AYUDA_VACIO = 'Cierra tu primer día para armar tu reporte';
const TEXTO_AYUDA_PERIODO_VACIO = 'No hay días cerrados en este periodo. Elige otro periodo.';
const TEXTO_AYUDA_PDF = 'El PDF lleva solo totales. No lleva tu Yape ni tus movimientos.';
const TITULO_PDF = 'Reporte de actividad del negocio';

// Crear enlace con QR (Sprint-16). El enlace es público: la confirmación lo dice con palabras sencillas.
export const TITULO_CONFIRMAR_SUBIDA = '¿Subir tu reporte para crear un enlace?';
export const TEXTO_CONFIRMAR_QUE_SUBE =
  'Se sube a internet el reporte en PDF del periodo que elegiste: tus ventas, tu resultado y tu constancia, con tu nombre, el de tu negocio y tu foto si la pusiste. El reporte llevará impreso el QR de su propio enlace.';
export const TEXTO_CONFIRMAR_QUE_NO =
  'No se sube tu Yape, tu ubicación ni tus cierres uno por uno.';
export const TEXTO_CONFIRMAR_PUBLICO = `Cualquiera que tenga el enlace podrá ver y descargar el reporte durante ${DIAS_ENLACE_REPORTE} días. Después el enlace deja de funcionar.`;
const TEXTO_SUBIENDO = 'Subiendo…';
const TEXTO_ERROR_NUBE: Record<string, string> = {
  PDF_GRANDE: 'El reporte pesa demasiado para subirlo. Prueba con un periodo más corto.',
  NO_SE_PUDO_PREPARAR: 'No pudimos preparar el PDF. Inténtalo otra vez.',
  LIMITE: 'Hay muchas subidas ahora. Prueba en un minuto.',
  SERVIDOR: 'No pudimos crear el enlace ahora. Inténtalo más tarde.',
  RESPUESTA_INVALIDA: 'No pudimos crear el enlace ahora. Inténtalo más tarde.',
  LIMITE_DIARIO: 'Hoy ya se subieron muchos reportes. Inténtalo mañana.',
};
/** Por qué no se pudo guardar el título en Mis reportes, en palabras claras. */
const TEXTO_ERROR_TITULO: Record<Exclude<ResultadoGuardarReporte, 'ok'>, string> = {
  limite: `Ya tienes ${MAX_REPORTES_GUARDADOS} reportes guardados. Quita uno de Mis reportes para guardar otro.`,
  'titulo-vacio': 'Escribe un título para tu reporte.',
  'no-existe': 'No pudimos guardarlo ahora. Inténtalo otra vez.',
};

const errorNubeDe = (r: Extract<ResultadoCrearEnlace, { ok: false }>): string =>
  TEXTO_ERROR_NUBE[r.error] ?? TEXTO_SIN_INTERNET;
/** Foto de la identidad en la hoja de pantalla, en dp. */
const TAMANO_FOTO = 56;
/** Lado del QR en la hoja de pantalla, en dp. */
const TAMANO_QR = 132;

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
  const { cierres, perfil, productos, cargando } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'MiReporte'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MiReporte'>>();
  const insets = useSafeAreaInsets();
  // El periodo viene de Resumen si ya había elegido uno; si no, todo el historial hasta hoy.
  const [filtro, setFiltro] = useState<FiltroPeriodo>(route.params?.filtro ?? FILTRO_TODO);

  const hoy = fechaLocal(new Date());
  // Todo lo del periodo se calcula una vez por cambio de cierres, productos o periodo.
  const datos = useMemo(
    () => datosDelReporte(cierres, filtro, productos, hoy),
    [cierres, filtro, productos, hoy],
  );
  const { senales, periodo, inteligencia, extra } = datos;
  const meses = useMemo(
    () => mesesConCierres(cierresDelReporte(cierres).cierres, hoy),
    [cierres, hoy],
  );
  const pasaporte = useMemo(() => construirPasaporte(senales), [senales]);

  // El mensaje amable del último fallo (o nada). Cerrar la hoja sin compartir no es un fallo.
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  // Un toque, una acción: mientras se prepara o se abre la hoja, otro toque no hace nada.
  const ocupado = useRef(false);
  // Se puede compartir siempre que el periodo tenga al menos un cierre.
  const sinDias = !puedeEmitirReporte(periodo);

  // Crear enlace con QR: nada sale hasta que la persona confirma. El enlace se recuerda en el teléfono.
  const [confirmando, setConfirmando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [entrada, setEntrada] = useState<EntradaReporte | null>(null);
  const [errorNube, setErrorNube] = useState<string | null>(null);
  // Guardar en "Mis reportes": solo si la persona lo pide, con un título que ella puede cambiar.
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null);
  const enlace = entrada === null ? null : enlaceDe(entrada);
  // La clave del reporte sale de sus DATOS (periodo, cierres, productos, nombre, negocio y foto), no de su
  // documento: no cambia con la fecha ni con la hora, ni con el QR del enlace.
  const clave = useMemo(
    () => claveDelReporte(periodo.etiqueta, periodo.cierres, productos, perfil, datos.soloEjemplo),
    [periodo, productos, perfil, datos.soloEjemplo],
  );
  // Si el contenido cambia, el QR desaparece; si vuelve a uno que ya tiene enlace vigente (de esta sesión o de
  // una anterior), reaparece. Esto solo mira el almacenamiento del teléfono: nunca habla con el Worker. Y si
  // ya hay una creación en curso para este contenido (la persona salió y volvió), se espera esa: no se lanza otra.
  useEffect(() => {
    let vivo = true;
    setEntrada(null);
    setErrorNube(null);
    setHojaAbierta(false);
    setEditandoTitulo(false);
    entradaVigente(clave).then(vigente => {
      if (vivo) setEntrada(vigente);
    });
    const enCurso = creacionEnCurso(clave);
    if (enCurso) {
      setSubiendo(true);
      enCurso.then(r => {
        if (!vivo) return;
        setSubiendo(false);
        if (r.ok) setEntrada(r.entrada);
      });
    }
    return () => {
      vivo = false;
    };
  }, [clave]);

  // El documento con el QR del enlace (si lo hay): lo que se comparte y lo que se sube es el mismo.
  const documento = (con?: EnlaceReporte | null) =>
    htmlReporte(senales, perfil, hoy, extra, con ?? undefined);

  const pedirEnlace = () => {
    if (ocupado.current || sinDias || subiendo) return;
    setErrorNube(null);
    // Ya hay un enlace para este mismo contenido: se muestra, sin confirmar ni subir nada otra vez.
    if (entrada !== null) {
      setHojaAbierta(true);
      return;
    }
    setConfirmando(true);
  };

  const subirYCrearEnlace = async () => {
    setConfirmando(false);
    if (ocupado.current || sinDias) return;
    ocupado.current = true;
    setSubiendo(true);
    try {
      const resultado = await crearEnlaceReporte(
        clave,
        { filtro, periodoEtiqueta: periodo.etiqueta },
        reservado => documento(reservado),
        NOMBRE_ARCHIVO_PDF(hoy),
        globalThis.fetch,
        JEV_URL,
      );
      if (resultado.ok) {
        setEntrada(resultado.entrada);
        setHojaAbierta(true);
      } else {
        // Si algo falló no queda QR ni enlace en pantalla.
        setEntrada(null);
        setErrorNube(errorNubeDe(resultado));
      }
    } catch {
      setEntrada(null);
      setErrorNube(TEXTO_ERROR_NUBE.SERVIDOR);
    } finally {
      ocupado.current = false;
      setSubiendo(false);
    }
  };

  const abrirTitulo = () => {
    setTitulo(entrada?.titulo ?? tituloSugerido(filtro.tipo, periodo.etiqueta, hoy));
    setErrorTitulo(null);
    setEditandoTitulo(true);
  };
  const guardarTitulo = async () => {
    const r = await guardarReporteEnLista(clave, titulo);
    if (r === 'ok') {
      setEntrada(await entradaVigente(clave));
      setEditandoTitulo(false);
      setErrorTitulo(null);
    } else {
      setErrorTitulo(TEXTO_ERROR_TITULO[r]);
    }
  };

  const compartirComoPdf = async () => {
    if (ocupado.current || sinDias) return;
    ocupado.current = true;
    setMensajeError(null);
    setPreparando(true);
    try {
      // El documento se arma aquí, al tocar: abrir la pantalla no genera ni comparte nada.
      // Con enlace vigente para este contenido el PDF lleva su QR; sin enlace, ninguno.
      const resultado = await compartirPdf(documento(enlace), NOMBRE_ARCHIVO_PDF(hoy), TITULO_PDF);
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
      // El texto se arma al tocar: abrir la pantalla no arma nada que no se vaya a compartir.
      const resultado = await compartirReporte(textoReporte(senales, perfil, hoy, extra));
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
      <ScreenHeader
        title="Mi reporte"
        subtitle="Para mostrarle a tu banco"
        onBack={() => navigation.goBack()}
        style={styles.encabezado}
        backTestID="reporte-atras"
      />
      <ScrollView contentContainerStyle={styles.contenido}>
        {cargando ? <CargandoBloques bloques={2} alto={160} testID="reporte-cargando" /> : null}

        {cargando ? null : datos.soloEjemplo ? (
          <Callout title="Datos de ejemplo" testID="reporte-aviso-ejemplo">
            {AVISO_EJEMPLO}
          </Callout>
        ) : null}

        {cargando ? null : senales.enConstruccion ? <EnConstruccion senales={senales} /> : null}

        {cargando || cierres.length === 0 ? null : (
          <SelectorPeriodo
            filtro={filtro}
            etiqueta={periodo.etiqueta}
            meses={meses}
            onChange={setFiltro}
            testID="reporte-filtro"
          />
        )}

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

        {cargando ? null : (
          <Hoja senales={senales} perfil={perfil} pasaporte={pasaporte} enlace={enlace} />
        )}
        {cargando || sinDias ? null : (
          <InteligenciaReporte inteligencia={inteligencia} etiquetaPeriodo={periodo.etiqueta} />
        )}
      </ScrollView>

      {/* Los botones viven FUERA del scroll, en un pie fijo: siempre a la mano del pulgar. */}
      <View style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }]}>
        {sinDias && !cargando ? (
          <Text variant="bodySmall" color="textMuted" align="center" testID="reporte-ayuda-vacio">
            {cierres.length === 0 ? TEXTO_AYUDA_VACIO : TEXTO_AYUDA_PERIODO_VACIO}
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
          disabled={sinDias || preparando || cargando}
          onPress={compartirComoPdf}
          testID="reporte-compartir-pdf"
        />
        <Button
          title="Compartir solo el texto"
          variant="outline"
          size="md"
          fullWidth
          disabled={sinDias || preparando || cargando || subiendo}
          onPress={compartirComoTexto}
          testID="reporte-compartir"
        />
        {errorNube !== null ? (
          <Text
            variant="bodySmall"
            color="danger"
            align="center"
            accessibilityLiveRegion="polite"
            testID="reporte-error-nube"
          >
            {errorNube}
          </Text>
        ) : null}
        <Button
          title={
            subiendo ? TEXTO_SUBIENDO : enlace !== null ? 'Ver mi enlace' : 'Crear enlace con QR'
          }
          leftIcon={Link2}
          variant="outline"
          size="md"
          fullWidth
          disabled={sinDias || preparando || cargando || subiendo}
          onPress={pedirEnlace}
          testID="reporte-crear-enlace"
        />
        <Button
          title="Mis reportes"
          leftIcon={FolderOpen}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.navigate('MisReportes')}
          testID="reporte-mis-reportes"
        />
        <Text variant="caption" color="textMuted" align="center" testID="reporte-ayuda-pdf">
          {TEXTO_AYUDA_PDF}
        </Text>
      </View>

      <BottomSheet
        visible={confirmando}
        onClose={() => setConfirmando(false)}
        accessibilityLabel="Confirmar la subida del reporte"
        testID="reporte-confirmar-subida"
        footer={
          <>
            <Button
              title="Sí, subir y crear el enlace"
              size="lg"
              fullWidth
              onPress={subirYCrearEnlace}
              testID="reporte-confirmar-subir"
            />
            <Button
              title="No, no subir nada"
              variant="ghost"
              fullWidth
              onPress={() => setConfirmando(false)}
              testID="reporte-confirmar-cancelar"
            />
          </>
        }
      >
        <Text variant="h3">{TITULO_CONFIRMAR_SUBIDA}</Text>
        <Text testID="reporte-confirmar-que-sube">{TEXTO_CONFIRMAR_QUE_SUBE}</Text>
        <Text testID="reporte-confirmar-que-no">{TEXTO_CONFIRMAR_QUE_NO}</Text>
        <Text variant="bodyStrong" testID="reporte-confirmar-publico">
          {TEXTO_CONFIRMAR_PUBLICO}
        </Text>
      </BottomSheet>

      <BottomSheet
        visible={hojaAbierta && entrada !== null}
        onClose={() => setHojaAbierta(false)}
        accessibilityLabel="Tu enlace con QR"
        testID="reporte-enlace-hoja"
        footer={
          <Button
            title="Listo"
            size="lg"
            fullWidth
            onPress={() => setHojaAbierta(false)}
            testID="reporte-enlace-listo"
          />
        }
      >
        {entrada !== null ? (
          <View style={styles.enlaceContenido}>
            <Text variant="h3">Tu enlace está listo</Text>
            <DetalleEnlaceReporte
              id={entrada.id}
              url={entrada.url}
              caduca={entrada.caduca}
              prefijo="reporte-enlace"
            />
            {entrada.guardado && !editandoTitulo ? (
              <Text variant="bodyStrong" testID="reporte-enlace-guardado">
                {`Guardado en Mis reportes: «${entrada.titulo}»`}
              </Text>
            ) : null}
            {editandoTitulo ? (
              <View style={styles.tituloCampo}>
                <Input
                  label="Título del reporte"
                  value={titulo}
                  onChangeText={setTitulo}
                  maxLength={MAX_TITULO}
                  error={errorTitulo ?? undefined}
                  testID="reporte-titulo"
                />
                <Button
                  title="Guardar"
                  fullWidth
                  onPress={guardarTitulo}
                  testID="reporte-titulo-guardar"
                />
                <Button
                  title="Cancelar"
                  variant="ghost"
                  fullWidth
                  onPress={() => setEditandoTitulo(false)}
                  testID="reporte-titulo-cancelar"
                />
              </View>
            ) : (
              <Button
                title={entrada.guardado ? 'Editar título' : 'Guardar en Mis reportes'}
                variant="outline"
                fullWidth
                onPress={abrirTitulo}
                testID="reporte-guardar"
              />
            )}
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
};

/** Aviso de que aún faltan días, con una barra de progreso: el naranja es solo el relleno. */
const EnConstruccion = ({ senales }: { senales: Senales }) => {
  const registrados = DIAS_CONVINCENTE - senales.diasFaltantes;
  return (
    <Callout testID="reporte-en-construccion">
      <Text variant="bodyStrong" testID="reporte-faltan">
        {textoFaltan(senales.diasFaltantes)}
      </Text>
      <ProgressBar
        value={registrados / DIAS_CONVINCENTE}
        accessibilityLabel="Días registrados"
        tone="accent"
        height={12}
        style={styles.progreso}
        testID="reporte-progreso"
      />
    </Callout>
  );
};

/** La vista previa como un documento: lo mismo que viaja en el texto, en una hoja blanca. */
const Hoja = ({
  senales,
  perfil,
  pasaporte,
  enlace,
}: {
  senales: Senales;
  perfil: Perfil;
  pasaporte: Pasaporte | null;
  enlace: EnlaceReporte | null;
}) => {
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
      <Text variant="labelStrong" color="primary" style={styles.marca}>
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

      {pasaporte !== null ? <SeccionPasaporte pasaporte={pasaporte} enlace={enlace} /> : null}

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

/**
 * El pasaporte para el banco: la cuota de referencia, los días registrados por mes y el código de
 * constancia con su QR. Todo en palabras y con su aclaración: es una referencia, no una aprobación.
 */
const SeccionPasaporte = ({
  pasaporte,
  enlace,
}: {
  pasaporte: Pasaporte;
  enlace: EnlaceReporte | null;
}) => {
  const modulos = useMemo(() => (enlace ? modulosQR(enlace.url) : null), [enlace]);
  const { cuota, constanciaMensual, soloEjemplo } = pasaporte;
  const marca = soloEjemplo ? (
    <Text variant="captionStrong" color="primary">
      {AVISO_EJEMPLO_SECCION}
    </Text>
  ) : null;
  return (
    <View style={styles.pasaporte} testID="reporte-pasaporte">
      <View style={styles.linea} />

      <View style={styles.bloque} testID="reporte-cuota-bloque">
        <Text variant="labelStrong">{TITULO_CUOTA}</Text>
        {marca}
        <Text variant="bodyStrong" testID="reporte-cuota">
          {textoCuota(cuota)}
        </Text>
        {cuota.disponible ? (
          <Text variant="bodySmall" color="textMuted" testID="reporte-cuota-explicacion">
            {explicacionCuota(cuota)}
          </Text>
        ) : null}
        <Text variant="bodySmall" color="textMuted" testID="reporte-cuota-nota">
          {NOTA_CUOTA}
        </Text>
      </View>

      <View style={styles.bloque} testID="reporte-constancia-bloque">
        <Text variant="labelStrong">Constancia de registro por mes</Text>
        {marca}
        {constanciaMensual.length === 0 ? (
          <Text variant="bodySmall" color="textMuted" testID="reporte-constancia-sin-mes">
            {SIN_CONSTANCIA_MES}
          </Text>
        ) : (
          constanciaMensual.map(m => (
            <Text variant="bodySmall" key={m.mes} testID={`reporte-constancia-mes-${m.mes}`}>
              {m.frase}
            </Text>
          ))
        )}
      </View>

      <View style={styles.bloque} testID="reporte-codigo-bloque">
        {enlace !== null && modulos !== null ? (
          <>
            <Text variant="labelStrong">{TITULO_CODIGO}</Text>
            {marca}
            <View style={styles.codigoFila}>
              <CodigoQR
                modulos={modulos}
                codigo={codigoDeEnlace(enlace.id)}
                etiqueta="Código QR del enlace de tu reporte"
                size={TAMANO_QR}
                testID="reporte-qr"
              />
              <Text variant="bodyStrong" style={styles.codigoTexto} testID="reporte-codigo">
                {codigoDeEnlace(enlace.id)}
              </Text>
            </View>
            <Text variant="bodyStrong" testID="reporte-qr-caduca">
              {textoCaduca(enlace.caduca)}
            </Text>
            <Text variant="caption" color="textMuted" selectable testID="reporte-qr-url">
              {enlace.url}
            </Text>
            <Text variant="bodySmall" color="textMuted" testID="reporte-codigo-nota">
              {NOTA_CODIGO}
            </Text>
          </>
        ) : (
          <Text variant="bodySmall" color="textMuted" testID="reporte-qr-aviso">
            {AVISO_SIN_ENLACE}
          </Text>
        )}
      </View>
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
          <Text variant="captionStrong" align="center" testID={`reporte-monto-${m.mes}`}>
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
  encabezado: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  contenido: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  // El naranja es solo relleno de la barra: las letras del aviso van en oscuro.
  progreso: { marginTop: spacing.sm },
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
  marca: { letterSpacing: 0.5 },
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
  zonaBarra: { height: ALTO_BARRAS, width: 40, justifyContent: 'flex-end' },
  barra: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  enlaceContenido: { gap: spacing.md, alignItems: 'center' },
  tituloCampo: { gap: spacing.md, alignSelf: 'stretch' },
  pasaporte: { gap: spacing.md },
  bloque: { gap: spacing.xs },
  codigoFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codigoTexto: { flex: 1 },
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
