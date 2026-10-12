// src/screens/InicioScreen.tsx
// Responde "¿cómo me fue?" y "¿qué decido hoy?". De arriba hacia abajo: saludo, UNA tarjeta
// con lo que te queda en el ciclo (vendiste, gastaste y el capital recuperado), tu último día,
// "Para decidir hoy", el insight, el Yape por cobrar, dos accesos y el botón "Cerrar mi día".
// El chat ya no es un botón flotante: es la pestaña "Asistente" de la barra inferior, y cada
// recomendación tiene su "Preguntar por qué" que lo abre con la pregunta lista.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Clock,
  FileText,
  HandCoins,
  Lightbulb,
  MessageCircle,
  PiggyBank,
  Scale,
  ShoppingBasket,
  Smartphone,
  Tag,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { MensajeError } from '@components/atoms/MensajeError';
import { MoneyText } from '@components/atoms/MoneyText';
import { ProgressBar } from '@components/atoms/ProgressBar';
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { AnotarYapeSheet } from '@components/organisms/AnotarYapeSheet';
import { EmptyState } from '@components/molecules/EmptyState';
import { ListRow } from '@components/molecules/ListRow';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { preguntaDeRegla } from '@analisis/preguntasRegla';
import { planificarManana, textoPorciones, type PlanManana } from '@analisis/planificador';
import { evaluarReglas } from '@analisis/reglas';
import {
  mostrarTuSemana,
  PREGUNTA_SEMANA,
  resumenSemanaPasada,
  textoMejorDia,
  textoPeorDia,
  textoTeQuedoSemana,
  type ResumenSemana,
} from '@analisis/semanal';
import { calcularCierre } from '@dominio/cierre';
import {
  agruparCiclos,
  porcentajeCapitalRecuperado,
  resumirCiclo,
  textoCapital,
} from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { textoAvisoDeCierre } from '@dominio/recordatorio';
import { formatoFecha, formatoFechaCorta, formatoSoles } from '@dominio/formato';
import { progreso, textoPlazo, totalAportado, type Meta } from '@dominio/meta';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useAhora } from '@hooks/useAhora';
import { useConteo } from '@hooks/useConteo';
import { useRecordatorio } from '@hooks/useRecordatorio';
import { useCrecemos, type EstadoSemilla } from '@context/CrecemosProvider';
import type { Ciclo, Recomendacion } from '@dominio/tipos';
import type { RootStackParamList } from '@navigation/RootStack';
import type { TabsParamList } from '@navigation/Tabs';

type InicioNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** El mismo periodo que mira "Qué me deja cada uno": los últimos 30 días, contando el día 30. */
const DIAS_DEL_INSIGHT = 30;

/** El ícono de cada recomendación. Es decorativo: el mensaje y el botón llevan el texto. */
const ICONO_DE_REGLA: Record<Recomendacion['reglaId'], LucideIcon> = {
  cobro: HandCoins,
  precio: Tag,
  preparar: ShoppingBasket,
  retiro: PiggyBank,
  diaFlojo: TrendingDown,
  comparacion: Scale,
};

export const InicioScreen = () => {
  const { cierres, productos, perfil, meta, cargando, semilla, cargarDatosDeEjemplo, marcarCobrado } =
    useCrecemos();
  const navigation = useNavigation<InicioNavigation>();
  const ahora = useAhora();
  const hoy = fechaLocal(ahora);
  const [anotandoYape, setAnotandoYape] = useState(false);
  const anotarYape = () => setAnotandoYape(true);

  // 'YYYY-MM-DD' ordena igual como texto que como fecha.
  const ultimo = cierres.reduce<(typeof cierres)[number] | null>(
    (masReciente, c) => (masReciente === null || c.fecha > masReciente.fecha ? c : masReciente),
    null,
  );
  const ciclos = useMemo(() => agruparCiclos(cierres), [cierres]);
  const cicloActual = ciclos[ciclos.length - 1];
  const porCobrar = useMemo(() => totalPorCobrar(cierres), [cierres]);
  const frase = useMemo(
    () => insight(gananciaPorProducto(cierres, restarDias(hoy, DIAS_DEL_INSIGHT), productos)),
    [cierres, hoy, productos],
  );
  const recomendaciones = useMemo(
    () => evaluarReglas({ cierres, productos, hoy }),
    [cierres, productos, hoy],
  );
  const plan = useMemo(() => planificarManana(cierres, productos, hoy), [cierres, productos, hoy]);
  const semana = useMemo(
    () => (mostrarTuSemana(hoy) ? resumenSemanaPasada(cierres, hoy) : null),
    [cierres, hoy],
  );
  const nombre = perfil.nombre.trim();
  const cerradoHoy = cierres.some(c => c.fecha === hoy);
  const recordatorio = useRecordatorio(perfil, cierres, cargando, ahora);
  const irACerrarDia = () => navigation.navigate('CerrarDia');
  const preguntarAlAsistente = (pregunta: string) => navigation.navigate('Asistente', { pregunta });

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <View style={styles.saludo}>
            <Text variant="h2" testID="inicio-saludo">
              {nombre ? `Hola, ${nombre}` : 'Hola'}
            </Text>
            <Text variant="bodySmall" color="textMuted" testID="inicio-fecha">
              {formatoFecha(fechaLocal(new Date()))}
            </Text>
          </View>
          {/* El círculo nunca va solo: lleva debajo su etiqueta (UX, regla 1). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            onPress={() => navigation.navigate('Perfil')}
            style={styles.perfil}
            testID="abrir-perfil"
          >
            <AvatarPerfil
              perfil={perfil}
              tamano={48}
              testIDFoto="inicio-avatar-foto"
              testIDIniciales="inicio-avatar-iniciales"
            />
            <Text variant="caption" color="primary">
              Mi perfil
            </Text>
          </Pressable>
        </View>

        {recordatorio.mostrarAviso ? (
          <AvisoDeCierre hora={recordatorio.hora} alCerrar={irACerrarDia} />
        ) : null}

        {cargando ? (
          <CargandoBloques bloques={3} alto={140} testID="inicio-cargando" />
        ) : ultimo && cicloActual ? (
          <>
            <TarjetaCiclo ciclo={cicloActual} />
            <UltimoDia fecha={ultimo.fecha} teQueda={calcularCierre(ultimo).teQueda} />
            {semana ? (
              <TarjetaSemana semana={semana} alPreguntar={() => preguntarAlAsistente(PREGUNTA_SEMANA)} />
            ) : null}
            <TarjetaMeta meta={meta} hoy={hoy} alAbrir={() => navigation.navigate('MiMeta')} />
            <Recomendaciones
              recomendaciones={recomendaciones}
              ciclos={ciclos.length}
              alPreguntar={preguntarAlAsistente}
            />
            <TarjetaManana plan={plan} />
            {frase ? (
              <TarjetaInsight frase={frase} alVer={() => navigation.navigate('QueMeDeja')} />
            ) : null}
            {porCobrar.pagos > 0 ? (
              <TarjetaPorCobrar
                pagos={porCobrar.pagos}
                total={porCobrar.total}
                alCobrar={marcarCobrado}
              />
            ) : null}
            <View style={styles.accionesRapidas} testID="inicio-acciones-rapidas">
              <AccionRapida
                icono={Scale}
                titulo="Qué me deja cada uno"
                alTocar={() => navigation.navigate('QueMeDeja')}
                testID="inicio-accion-que-me-deja"
              />
              <AccionRapida
                icono={FileText}
                titulo="Mi reporte"
                alTocar={() => navigation.navigate('MiReporte')}
                testID="inicio-accion-mi-reporte"
              />
              <AccionRapida
                icono={Smartphone}
                titulo="Anotar un yape"
                alTocar={anotarYape}
                testID="inicio-accion-anotar-yape"
              />
            </View>
            {/* La única acción principal de la pantalla (UX, regla 2). Si hoy ya está cerrado,
                no insiste: ofrece editar con calma. */}
            {cerradoHoy ? (
              <Button
                title="Hoy ya cerraste ✓ · Editar"
                variant="outline"
                size="lg"
                fullWidth
                testID="inicio-editar-hoy"
                onPress={irACerrarDia}
              />
            ) : (
              <Button
                title="Cerrar mi día"
                size="lg"
                fullWidth
                testID="inicio-cerrar-dia-rapido"
                onPress={irACerrarDia}
              />
            )}
          </>
        ) : (
          <>
            <EmptyState
              title="Aún no cierras ningún día"
              text="Cuando cierres tu día, aquí verás el resultado registrado: ventas menos gastos."
              actionLabel="Cerrar mi día"
              onAction={irACerrarDia}
              actionTestID="inicio-cerrar-dia"
            />
            {productos.length === 0 ? (
              <DatosDeEjemplo estado={semilla} alCargar={cargarDatosDeEjemplo} />
            ) : null}
            <View style={styles.accionesRapidas}>
              <AccionRapida
                icono={Smartphone}
                titulo="Anotar un yape"
                alTocar={anotarYape}
                testID="inicio-accion-anotar-yape"
              />
            </View>
          </>
        )}
      </ScrollView>
      <AnotarYapeSheet visible={anotandoYape} onClose={() => setAnotandoYape(false)} />
    </SafeAreaView>
  );
};

/**
 * La tarjeta de lo que te queda en el ciclo de compra actual: el monto grande (cuenta hasta su
 * valor), cuánto vendiste, cuánto gastaste de verdad (mercadería incluida) y la barra del capital.
 */
const TarjetaCiclo = ({ ciclo }: { ciclo: Ciclo }) => {
  const resumen = resumirCiclo(ciclo);
  const recuperado = resumen.capitalRecuperadoEn !== undefined;
  const porcentaje = porcentajeCapitalRecuperado(resumen);
  // `capital` es la suma de TODOS los gastos del ciclo (mercadería, carbón, gas…): ventas − gastos.
  const gastado = resumen.capital;
  const mostrado = useConteo(resumen.teQueda);

  return (
    <Card testID="inicio-ciclo">
      <Text variant="label" color="textMuted" testID="inicio-ciclo-titulo">
        Te queda en este ciclo
      </Text>
      <Text variant="caption" color="textMuted" testID="inicio-ciclo-dia">
        {`Ciclo de compra · día ${ciclo.cierres.length}`}
      </Text>
      {ciclo.cierres[0].abreCiclo ? (
        <Text variant="bodySmall" color="textMuted" testID="inicio-ciclo-compra">
          {`Compraste el ${formatoFecha(ciclo.inicio).toLowerCase()}`}
        </Text>
      ) : null}
      {/* El lector de pantalla oye el valor final, no los números que van pasando. */}
      <View
        accessible
        accessibilityLabel={`Te queda en este ciclo: ${formatoSoles(resumen.teQueda)}`}
        style={styles.montoHero}
      >
        <MoneyText monto={mostrado} variant="hero" testID="inicio-ciclo-te-queda" />
      </View>
      <Text variant="caption" color="textMuted">
        Ventas menos gastos del ciclo. Incluye pagos pendientes de recibir.
      </Text>
      <View style={styles.fila}>
        <View style={styles.columna}>
          <View style={styles.etiquetaFila}>
            <Icon icon={ArrowUp} color="success" size="sm" />
            <Text variant="label" color="textMuted">
              Vendiste
            </Text>
          </View>
          <MoneyText
            monto={resumen.venta}
            tone="ingreso"
            variant="h3"
            testID="inicio-ciclo-vendiste"
          />
        </View>
        <View style={styles.columna}>
          <View style={styles.etiquetaFila}>
            <Icon icon={ArrowDown} color="danger" size="sm" />
            <Text variant="label" color="textMuted">
              Gastaste
            </Text>
          </View>
          <MoneyText monto={gastado} tone="gasto" variant="h3" testID="inicio-ciclo-gastaste" />
        </View>
      </View>
      {resumen.capital > 0 ? (
        <View style={styles.capital}>
          {/* El naranja es solo relleno; el texto va siempre en letra oscura (UX, regla 5). */}
          <ProgressBar
            value={porcentaje / 100}
            accessibilityLabel="Capital recuperado"
            tone={recuperado ? 'success' : 'accent'}
            height={10}
            testID="inicio-ciclo-barra"
          />
          <Text variant="caption" testID="inicio-ciclo-capital">
            {textoCapital(resumen)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
};

/** Una fila chica con el resultado del último día cerrado (antes era una tarjeta duplicada). */
const UltimoDia = ({ fecha, teQueda }: { fecha: string; teQueda: number }) => (
  <Card variant="bordered" flush testID="inicio-ultimo-dia">
    <ListRow
      icon={CalendarDays}
      title={`Tu último día · ${formatoFecha(fecha)}`}
      subtitle="Resultado registrado"
      divider={false}
      trailing={
        <Text
          variant="h3"
          color={teQueda < 0 ? 'danger' : 'success'}
          testID="inicio-te-queda"
          numberOfLines={1}
        >
          {formatoSoles(teQueda)}
        </Text>
      }
    />
  </Card>
);

/**
 * "Tu semana": cómo cerró la última semana completa (lunes a domingo). Solo lunes a miércoles y
 * solo si tiene 3 días registrados o más; no se oculta sola, la decide el calendario. Con datos de
 * ejemplo lo dice, para que no pasen por cifras reales.
 */
const TarjetaSemana = ({
  semana,
  alPreguntar,
}: {
  semana: ResumenSemana;
  alPreguntar: () => void;
}) => (
  <Card variant="bordered" testID="inicio-semana">
    <Text variant="h3" accessibilityRole="header">
      Tu semana
    </Text>
    <Text variant="caption" color="textMuted" testID="inicio-semana-rango">
      {`${formatoFechaCorta(semana.desde)} al ${formatoFechaCorta(semana.hasta)} · ${semana.diasRegistrados} de 7 días registrados`}
    </Text>
    {semana.soloEjemplo ? (
      <Text variant="caption" color="textMuted" testID="inicio-semana-ejemplo">
        Datos de ejemplo
      </Text>
    ) : null}
    <Text variant="h3" style={styles.separadoChico} testID="inicio-semana-te-queda">
      {textoTeQuedoSemana(semana.teQueda)}
    </Text>
    <Text variant="bodySmall" color="textMuted" testID="inicio-semana-ventas-gastos">
      {`Vendiste ${formatoSoles(semana.vendido)} y gastaste ${formatoSoles(semana.gastado)}`}
    </Text>
    {semana.comparacion ? (
      <Text variant="bodyStrong" style={styles.separadoChico} testID="inicio-semana-comparacion">
        {semana.comparacion.texto}
      </Text>
    ) : null}
    {semana.mejorDia ? (
      <Text style={styles.separadoChico} testID="inicio-semana-mejor">
        {textoMejorDia(semana.mejorDia)}
      </Text>
    ) : null}
    {semana.peorDia ? (
      <Text color="textMuted" testID="inicio-semana-peor">
        {textoPeorDia(semana.peorDia)}
      </Text>
    ) : null}
    <Button
      title="Preguntar por qué"
      variant="ghost"
      leftIcon={MessageCircle}
      style={styles.preguntarPorQue}
      testID="inicio-semana-preguntar"
      onPress={alPreguntar}
    />
  </Card>
);

/**
 * El recordatorio diario, dentro de la app: pasada la hora elegida y con el día sin cerrar, avisa y
 * ofrece el botón. No se quita solo: se va cuando cierras tu día o cuando empieza otro día.
 */
const AvisoDeCierre = ({ hora, alCerrar }: { hora: string; alCerrar: () => void }) => (
  <Callout icon={Clock} accessibilityLiveRegion="polite" testID="inicio-aviso-cierre">
    <Text variant="bodyStrong" testID="inicio-aviso-cierre-texto">
      {textoAvisoDeCierre(hora)}
    </Text>
    <Button
      title="Cerrar mi día"
      size="lg"
      fullWidth
      style={styles.separadoChico}
      testID="inicio-aviso-cierre-boton"
      onPress={alCerrar}
    />
  </Callout>
);

/**
 * Mi cuota: cuánto lleva separado para la cuota del préstamo y cuánto falta de tiempo. Sin meta,
 * una invitación calmada a crearla (no un botón principal: el principal es "Cerrar mi día").
 */
const TarjetaMeta = ({ meta, hoy, alAbrir }: { meta: Meta | null; hoy: string; alAbrir: () => void }) =>
  meta ? (
    <Card variant="bordered" testID="inicio-meta">
      <Text variant="label" color="textMuted">
        {meta.nombre}
      </Text>
      <Text variant="h3" testID="inicio-meta-avance">
        {`${formatoSoles(totalAportado(meta))} de ${formatoSoles(meta.montoObjetivo)}`}
      </Text>
      <ProgressBar
        value={progreso(meta)}
        accessibilityLabel="Avance de tu meta"
        height={10}
        tone={progreso(meta) >= 1 ? 'success' : 'primary'}
        style={styles.separadoChico}
        testID="inicio-meta-barra"
      />
      <Text variant="bodySmall" color="textMuted" testID="inicio-meta-plazo">
        {textoPlazo(meta, hoy)}
      </Text>
      <Button
        title="Ver mi meta"
        variant="ghost"
        rightIcon={ArrowRight}
        style={styles.preguntarPorQue}
        onPress={alAbrir}
        testID="inicio-ver-meta"
      />
    </Card>
  ) : (
    <Button
      title="Crear una meta para mi cuota"
      variant="outline"
      leftIcon={PiggyBank}
      fullWidth
      onPress={alAbrir}
      testID="inicio-crear-meta"
    />
  );

/**
 * La frase que contrasta lo que se vende con lo que deja. El naranja es solo fondo, borde e ícono
 * (UX, regla 5): el texto va en letra oscura y el enlace, en el color de marca.
 */
const TarjetaInsight = ({ frase, alVer }: { frase: string; alVer: () => void }) => (
  <Callout icon={Lightbulb} testID="inicio-insight">
    <Text variant="bodyStrong" testID="inicio-insight-texto">
      {frase}
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Qué me deja cada uno"
      onPress={alVer}
      style={styles.enlace}
      testID="inicio-ver-que-me-deja"
    >
      <Text variant="bodyStrong" color="primary" testID="inicio-ver-que-me-deja-texto">
        Qué me deja cada uno
      </Text>
      <Icon icon={ArrowRight} color="primary" size="md" />
    </Pressable>
  </Callout>
);

/**
 * Hasta 2 decisiones para hoy, por prioridad. Con cierres pero menos de 2 ciclos, el motor no
 * inventa: lo dice. Con 2 ciclos o más y ninguna recomendación, no muestra nada.
 */
const Recomendaciones = ({
  recomendaciones,
  ciclos,
  alPreguntar,
}: {
  recomendaciones: Recomendacion[];
  ciclos: number;
  alPreguntar: (pregunta: string) => void;
}) => {
  if (recomendaciones.length === 0) {
    return ciclos < 2 ? (
      <Card>
        <Text color="textMuted" testID="inicio-sin-recomendaciones">
          Cierra 2 ciclos para ver recomendaciones
        </Text>
      </Card>
    ) : null;
  }
  return (
    <View style={styles.recomendaciones} testID="inicio-recomendaciones">
      <Text variant="h3" accessibilityRole="header">
        Para decidir hoy
      </Text>
      {recomendaciones.map(r => (
        <Card key={r.reglaId} variant="bordered" testID={`inicio-recomendacion-${r.reglaId}`}>
          <View style={styles.recomendacionFila}>
            <View style={styles.circuloIcono}>
              <Icon icon={ICONO_DE_REGLA[r.reglaId]} color="primary" size="md" />
            </View>
            <Text style={styles.recomendacionTexto} testID={`inicio-recomendacion-${r.reglaId}-texto`}>
              {r.mensaje}
            </Text>
          </View>
          <Button
            title="Preguntar por qué"
            variant="ghost"
            leftIcon={MessageCircle}
            style={styles.preguntarPorQue}
            testID={`inicio-porque-${r.reglaId}`}
            onPress={() => alPreguntar(preguntaDeRegla(r.reglaId))}
          />
        </Card>
      ))}
    </View>
  );
};

/**
 * "Para mañana": cuántas porciones preparar de cada producto para sacar todo sin quedarte corto,
 * con lo que pondrías de mercadería. Sin datos suficientes lo dice, no inventa.
 */
const TarjetaManana = ({ plan }: { plan: PlanManana }) => {
  const titulo = `Para mañana · ${plan.dia.charAt(0).toUpperCase()}${plan.dia.slice(1)}`;
  return (
    <Card variant="bordered" testID="inicio-manana">
      <Text variant="h3" accessibilityRole="header">
        {titulo}
      </Text>
      {plan.sugerencias.map(s => (
        <View key={s.productoId} style={styles.mananaFila} testID={`inicio-manana-${s.productoId}`}>
          <View style={styles.filaSpace}>
            <Text variant="bodyStrong" style={styles.recomendacionTexto}>
              {s.nombre}
            </Text>
            {s.porciones !== null ? (
              <Text variant="bodyStrong" testID={`inicio-manana-${s.productoId}-porciones`}>
                {textoPorciones(s.porciones, s.unidad)}
              </Text>
            ) : null}
          </View>
          <Text
            variant="caption"
            color="textMuted"
            testID={`inicio-manana-${s.productoId}-texto`}
          >
            {s.texto}
          </Text>
        </View>
      ))}
      {plan.datosInsuficientes ? null : (
        <Text variant="label" style={styles.separado} testID="inicio-manana-capital">
          {`Pondrías ${formatoSoles(plan.capital)} de mercadería`}
        </Text>
      )}
    </Card>
  );
};

/** Un acceso secundario: tarjeta con ícono Y texto (UX, regla 1), de al menos 48 dp. */
const AccionRapida = ({
  icono,
  titulo,
  alTocar,
  testID,
}: {
  icono: LucideIcon;
  titulo: string;
  alTocar: () => void;
  testID: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={titulo}
    onPress={alTocar}
    style={({ pressed }) => [styles.accion, pressed && styles.accionPresionada]}
    testID={testID}
  >
    <Icon icon={icono} color="primary" size="lg" />
    <Text variant="labelStrong" align="center">
      {titulo}
    </Text>
  </Pressable>
);

/** El Yape que entró a una cuenta ajena y todavía no recibe. Confirma diciendo cuánto, en la misma tarjeta. */
const TarjetaPorCobrar = ({
  pagos,
  total,
  alCobrar,
}: {
  pagos: number;
  total: number;
  alCobrar: () => Promise<void>;
}) => {
  const [confirmando, setConfirmando] = useState(false);
  // Si no se pudo marcar, la pregunta sigue a la vista con el aviso para volver a intentar.
  const { ejecutar: yaLosRecibi, ejecutando: guardando, mensajeError } = useAccionSegura(
    async () => {
      await alCobrar();
      setConfirmando(false);
    },
    'No pudimos marcarlo como cobrado. Inténtalo otra vez.',
  );

  return (
    <Card variant="bordered">
      <View style={styles.filaSpace}>
        <View style={styles.columna}>
          <Text variant="label">Yape por cobrar</Text>
          <Text variant="caption" color="textMuted" testID="inicio-por-cobrar-pagos">
            {pagos === 1 ? '1 pago' : `${pagos} pagos`}
          </Text>
        </View>
        <Text variant="h3" testID="inicio-por-cobrar-total">
          {formatoSoles(total)}
        </Text>
      </View>
      {confirmando ? (
        <View style={styles.separado}>
          <Text variant="bodyStrong" testID="inicio-cobrado-pregunta">
            {`¿Ya recibiste ${formatoSoles(total)} en tu Yape?`}
          </Text>
          <MensajeError mensaje={mensajeError} testID="inicio-cobrado-error" />
          <Button
            title="Sí, ya los recibí"
            variant="outline"
            fullWidth
            disabled={guardando}
            style={styles.separado}
            testID="inicio-cobrado-si"
            onPress={() => yaLosRecibi()}
          />
          <Button
            title="No, todavía"
            variant="ghost"
            fullWidth
            disabled={guardando}
            style={styles.separadoChico}
            testID="inicio-cobrado-no"
            onPress={() => setConfirmando(false)}
          />
        </View>
      ) : (
        <Button
          title="Marcar como cobrado"
          variant="outline"
          fullWidth
          style={styles.separado}
          testID="inicio-marcar-cobrado"
          onPress={() => setConfirmando(true)}
        />
      )}
    </Card>
  );
};

/**
 * Sin días cerrados, qué decir de los datos de ejemplo. Nunca un código ni una excepción:
 * sin señal la app funciona igual. Quien ya resolvió la semilla (la cargó o ya tiene su
 * propia historia) no vuelve a ver nada de esto.
 */
const DatosDeEjemplo = ({
  estado,
  alCargar,
}: {
  estado: EstadoSemilla;
  alCargar: () => Promise<void>;
}) => {
  if (estado === 'lista') return null;
  const mensaje =
    estado === 'cargando'
      ? 'Cargando datos de ejemplo…'
      : estado === 'invalida'
      ? 'No pudimos cargar los datos de ejemplo'
      : estado === 'sinRed'
      ? 'No pudimos cargar los datos de ejemplo. Revisa tu conexión e inténtalo otra vez.'
      : 'Puedes probar la app con datos de ejemplo. Se cargarán solo si tocas este botón.';
  return (
    <Card>
      <Text color="textMuted" testID="inicio-semilla-mensaje">
        {mensaje}
      </Text>
      {estado === 'cargando' ? null : (
        <Button
          title="Cargar datos de ejemplo"
          variant="outline"
          fullWidth
          style={styles.separado}
          testID="inicio-cargar-ejemplo"
          onPress={() => {
            alCargar().catch(() => undefined);
          }}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saludo: { flex: 1, paddingRight: spacing.md },
  perfil: { minWidth: 48, minHeight: 48, alignItems: 'center', gap: spacing.xxs },
  montoHero: { marginTop: spacing.sm },
  etiquetaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  capital: { marginTop: spacing.md, gap: spacing.sm },
  enlace: {
    alignSelf: 'flex-start',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recomendaciones: { gap: spacing.md },
  recomendacionFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  recomendacionTexto: { flex: 1 },
  circuloIcono: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mananaFila: { marginTop: spacing.md, gap: spacing.xxs },
  preguntarPorQue: { alignSelf: 'flex-start', marginTop: spacing.sm },
  accionesRapidas: { flexDirection: 'row', gap: spacing.md },
  accion: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  accionPresionada: { backgroundColor: colors.surfacePressed },
  separado: { marginTop: spacing.md },
  separadoChico: { marginTop: spacing.sm },
  filaSpace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fila: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  columna: { flex: 1 },
});
