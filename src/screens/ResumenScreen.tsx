// src/screens/ResumenScreen.tsx
// "Resumen" (mock 04): el ciclo de compra actual. "El primer día es para el capital y el
// segundo es la ganancia" dibujado como una barra, y cuánto de la mercadería se vendió.
// Con 2 ciclos o más, una fila compara con el ciclo anterior: el texto y el monto, nunca solo un
// porcentaje. Debajo, "Tus números": el filtro de periodo y los gráficos (la torta de ventas por
// producto, las barras por mes y por producto y los últimos días). Termina con los botones a "Qué me
// deja cada uno", "Mi reporte" y "Preguntarle a mis datos" (la pestaña Asistente).
// Sprint-15 enmienda D42 por pedido del usuario: entran el filtro de periodo y los gráficos; siguen
// fuera el gráfico de ciclos y buscar. Las barras son Views de ancho porcentual; solo la torta usa
// react-native-svg.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Info, Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { ProgressBar } from '@components/atoms/ProgressBar';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { EmptyState } from '@components/molecules/EmptyState';
import { BarrasPorMes } from '@components/molecules/BarrasPorMes';
import { BarrasPorProducto } from '@components/molecules/BarrasPorProducto';
import { GraficoTorta } from '@components/molecules/GraficoTorta';
import { GraficoUltimosDias, type TramoDias } from '@components/molecules/GraficoUltimosDias';
import { SelectorPeriodo } from '@components/organisms/SelectorPeriodo';
import { ultimosDias } from '@analisis/graficos';
import { inteligenciaDelNegocio, ultimosMeses } from '@analisis/inteligencia';
import { compararCiclos } from '@analisis/metricas';
import { FILTRO_TODO, mesesConCierres, periodoDe, type FiltroPeriodo } from '@analisis/periodo';
import { fechaLocal } from '@dominio/fecha';
import { mercaderiaDelCiclo, textoCapital } from '@dominio/ciclo';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import type { Cierre, Ciclo, FechaNegocio, Producto, ResumenCiclo } from '@dominio/tipos';
import { unidadSegunCantidad } from '@dominio/unidades';
import { useCrecemos } from '@context/CrecemosProvider';
import { useConteo } from '@hooks/useConteo';
import { useAhora } from '@hooks/useAhora';
import { useDerivados } from '@hooks/useDerivados';
import { useEsconderBarraAlDesplazar } from '@context/BarraOcultaContext';
import { useMedidasBarra } from '@hooks/useMedidasBarra';
import type { RootStackParamList } from '@navigation/RootStack';
import type { TabsParamList } from '@navigation/Tabs';

type ResumenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Resumen'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Por debajo de este porcentaje vendido, la barra de un producto va en naranja (solo relleno).
const VENDIDO_MINIMO = 70;

const porcentaje = (parte: number, total: number): number =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

const rango = (ciclo: Ciclo): string =>
  ciclo.inicio === ciclo.fin
    ? formatoFechaCorta(ciclo.inicio)
    : `${formatoFechaCorta(ciclo.inicio)} — ${formatoFechaCorta(ciclo.fin)}`;

/** Cuántos meses dibujan las barras por mes. */
const MESES_EN_BARRAS = 6;
const AVISO_EJEMPLO = 'Incluye datos de ejemplo';

export const ResumenScreen = () => {
  const { productos, cierres, cargando } = useCrecemos();
  const hoy = fechaLocal(useAhora());
  // El periodo es una mirada pasajera: vive en la pantalla y se lo pasa a "Mi reporte".
  const [filtro, setFiltro] = useState<FiltroPeriodo>(FILTRO_TODO);
  const {
    cicloActual: actual,
    cicloAnterior: anterior,
    resumenActual,
    resumenAnterior,
  } = useDerivados();
  const navigation = useNavigation<ResumenNavigation>();
  const { rellenoContenido } = useMedidasBarra();
  const esconderBarra = useEsconderBarraAlDesplazar();

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      {/* El título va fuera del scroll: queda fijo mientras el contenido se desplaza. */}
      <View style={styles.encabezado}>
        <Text variant="h1" accessibilityRole="header">
          Resumen
        </Text>
      </View>
      <ScrollView
        {...esconderBarra}
        contentContainerStyle={[styles.contenido, { paddingBottom: rellenoContenido }]}
      >
        {cargando ? (
          <CargandoBloques bloques={3} alto={120} testID="resumen-cargando" />
        ) : actual && resumenActual ? (
          <CicloActual
            ciclo={actual}
            resumen={resumenActual}
            resumenAnterior={anterior ? resumenAnterior : null}
            productos={productos}
          />
        ) : (
          <EmptyState
            title="Aún no cierras ningún día"
            text="Cuando cierres tu día, aquí verás el resultado registrado de tu ciclo de compra y cuánto vendiste de tu mercadería."
            actionLabel="Cerrar mi día"
            onAction={() => navigation.navigate('CerrarDia')}
            testID="resumen-vacio"
            actionTestID="resumen-cerrar-dia"
          />
        )}

        {cargando || cierres.length === 0 ? null : (
          <Graficos
            cierres={cierres}
            productos={productos}
            hoy={hoy}
            filtro={filtro}
            onCambiarFiltro={setFiltro}
          />
        )}

        {cargando ? null : (
          <>
            <Button
              title="Qué me deja cada uno"
              variant="outline"
              size="lg"
              fullWidth
              testID="resumen-que-me-deja"
              onPress={() => navigation.navigate('QueMeDeja')}
            />
            <Button
              title="Mi reporte"
              variant="outline"
              size="lg"
              fullWidth
              testID="resumen-mi-reporte"
              onPress={() => navigation.navigate('MiReporte', { filtro })}
            />
            <Button
              title="Preguntarle a mis datos"
              variant="outline"
              size="lg"
              fullWidth
              testID="resumen-preguntar"
              onPress={() => navigation.navigate('Asistente')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * "Tus números": el filtro de periodo y los gráficos. Todo se calcula una vez por cambio de cierres,
 * productos, periodo o día (`useMemo`): con 150 cierres no se recalcula en cada render. Usa los mismos
 * cierres que el resto de la pantalla, los de ejemplo incluidos, y lo avisa.
 */
const Graficos = ({
  cierres,
  productos,
  hoy,
  filtro,
  onCambiarFiltro,
}: {
  cierres: Cierre[];
  productos: Producto[];
  hoy: FechaNegocio;
  filtro: FiltroPeriodo;
  onCambiarFiltro: (filtro: FiltroPeriodo) => void;
}) => {
  const [tramo, setTramo] = useState<TramoDias>(14);
  const meses = useMemo(() => mesesConCierres(cierres, hoy), [cierres, hoy]);
  const periodo = useMemo(() => periodoDe(filtro, hoy, cierres), [filtro, hoy, cierres]);
  const inteligencia = useMemo(
    () => inteligenciaDelNegocio(periodo.cierres, productos, hoy),
    [periodo, productos, hoy],
  );
  const barrasMeses = useMemo(
    () => ultimosMeses(inteligencia.meses, MESES_EN_BARRAS),
    [inteligencia],
  );
  const dias = useMemo(() => ultimosDias(periodo.cierres, periodo, tramo), [periodo, tramo]);

  return (
    <View style={styles.seccion} testID="resumen-graficos">
      <Text variant="h2" accessibilityRole="header">
        Tus números
      </Text>
      <SelectorPeriodo
        filtro={filtro}
        etiqueta={periodo.etiqueta}
        meses={meses}
        onChange={onCambiarFiltro}
        testID="resumen-filtro"
      />
      <Text variant="bodySmall" color="textMuted">
        El periodo cambia solo los gráficos de esta sección.
      </Text>
      {inteligencia.hayEjemplo ? (
        <Callout icon={Info} testID="resumen-aviso-ejemplo">
          <Text variant="bodySmall" testID="resumen-aviso-ejemplo-texto">
            {AVISO_EJEMPLO}
          </Text>
        </Callout>
      ) : null}

      <Text variant="h3" accessibilityRole="header">
        Qué producto se vende más
      </Text>
      <Card>
        <GraficoTorta porciones={inteligencia.torta} />
      </Card>

      <Text variant="h3" accessibilityRole="header">
        Ventas y resultado por mes
      </Text>
      <Card>
        <BarrasPorMes meses={barrasMeses} />
      </Card>

      <Text variant="h3" accessibilityRole="header">
        Cuánto vendiste de cada producto
      </Text>
      <Card>
        <BarrasPorProducto productos={inteligencia.productos} />
      </Card>

      <Text variant="h3" accessibilityRole="header">
        Resultado de los últimos días
      </Text>
      <Card>
        <GraficoUltimosDias datos={dias} tramo={tramo} onCambiarTramo={setTramo} />
      </Card>
    </View>
  );
};

const CicloActual = ({
  ciclo,
  resumen,
  resumenAnterior,
  productos,
}: {
  ciclo: Ciclo;
  resumen: ResumenCiclo;
  resumenAnterior: ResumenCiclo | null;
  productos: Producto[];
}) => {
  const mercaderia = useMemo(() => mercaderiaDelCiclo(ciclo, productos), [ciclo, productos]);

  // La ganancia es lo que te queda mientras sea positivo; si vendió menos que su capital, no hay.
  const ganancia = Math.max(resumen.teQueda, 0);
  const total = resumen.capital + ganancia;
  const capitalPorcentaje = porcentaje(resumen.capital, total);
  // Las cifras cuentan hasta su valor; el lector de pantalla oye el valor final (accessibilityLabel).
  const teQuedaMostrado = useConteo(resumen.teQueda);
  const capitalMostrado = useConteo(resumen.capital);
  const gananciaMostrada = useConteo(ganancia);

  // Lo que más plata dejó sin vender; en un empate, el primero por nombre.
  const masSobrante = mercaderia.reduce<(typeof mercaderia)[number] | null>(
    (mayor, m) => (m.sobranteSoles > (mayor?.sobranteSoles ?? 0) ? m : mayor),
    null,
  );

  return (
    <>
      <Card>
        <View style={styles.filaCiclo} testID="resumen-ciclo-fila">
          <Text variant="label" color="textMuted">
            Ciclo actual
          </Text>
          <Text variant="label" color="textMuted" style={styles.rango} testID="resumen-rango">
            {rango(ciclo)}
          </Text>
        </View>

        <Text variant="bodyStrong" style={styles.separado}>
          Resultado registrado
        </Text>
        <Text
          variant="hero"
          color={resumen.teQueda < 0 ? 'danger' : 'success'}
          testID="resumen-te-queda"
          accessibilityLabel={formatoSoles(resumen.teQueda)}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {formatoSoles(teQuedaMostrado)}
        </Text>
        <Text variant="caption" color="textMuted">
          Ventas menos gastos registrados. Incluye pagos pendientes de recibir.
        </Text>

        {total > 0 ? (
          // Dos tramos en una sola barra (capital y resultado positivo): el lector de pantalla
          // oye qué parte del total es capital.
          <View
            style={[styles.barra, styles.separado]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Capital contra resultado positivo"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: capitalPorcentaje,
              text: `El capital es el ${capitalPorcentaje} por ciento de lo vendido`,
            }}
            testID="resumen-barra"
          >
            <View
              style={{ width: `${capitalPorcentaje}%`, backgroundColor: colors.danger }}
              testID="resumen-barra-capital"
            />
            <View
              style={{ width: `${100 - capitalPorcentaje}%`, backgroundColor: colors.success }}
              testID="resumen-barra-ganancia"
            />
          </View>
        ) : null}
        {/* A 360 dp con fuente grande no caben lado a lado: la fila se parte en dos líneas. */}
        <View style={[styles.filaCapital, styles.separadoChico]} testID="resumen-capital-fila">
          <Text
            variant="bodyStrong"
            color="danger"
            style={styles.cifraCapital}
            testID="resumen-capital"
            accessibilityLabel={`Capital ${formatoSoles(resumen.capital)}`}
          >
            {`Capital ${formatoSoles(capitalMostrado)}`}
          </Text>
          <Text
            variant="bodyStrong"
            color="success"
            style={styles.cifraCapital}
            testID="resumen-ganancia"
            accessibilityLabel={`Resultado positivo ${formatoSoles(ganancia)}`}
          >
            {`Resultado positivo ${formatoSoles(gananciaMostrada)}`}
          </Text>
        </View>

        {resumen.capital > 0 ? (
          <Text
            variant="caption"
            color="textMuted"
            style={styles.separado}
            testID="resumen-capital-texto"
          >
            {textoCapital(resumen)}
          </Text>
        ) : null}
      </Card>

      {resumenAnterior ? <Comparacion actual={resumen} anterior={resumenAnterior} /> : null}

      {mercaderia.length > 0 ? (
        <View style={styles.seccion}>
          <Text variant="h3">Tu mercadería</Text>
          <Card>
            {mercaderia.map((m, i) => {
              const vendido = porcentaje(m.vendidas, m.preparadas);
              const bien = vendido >= VENDIDO_MINIMO;
              const base = `mercaderia-${m.productoId}`;
              const unidad = productos.find(p => p.id === m.productoId)?.unidad;
              const etiquetaUnidad = unidadSegunCantidad(m.preparadas, unidad);
              return (
                <View key={m.productoId} style={i > 0 ? styles.separado : undefined} testID={base}>
                  <Text testID={`${base}-texto`}>
                    {`${m.nombre} — vendiste ${m.vendidas} de ${m.preparadas} ${etiquetaUnidad}`}
                  </Text>
                  <View style={[styles.filaBarra, styles.separadoChico]}>
                    <ProgressBar
                      value={vendido / 100}
                      accessibilityLabel={`Vendido de ${m.nombre}`}
                      tone={bien ? 'success' : 'accent'}
                      height={12}
                      style={styles.pista}
                      testID={`${base}-barra`}
                    />
                    {/* El naranja es solo relleno de barra: el número va en letra oscura. */}
                    <Text
                      variant="bodyStrong"
                      color={bien ? 'success' : 'text'}
                      style={styles.porcentaje}
                      testID={`${base}-porcentaje`}
                    >
                      {`${vendido}%`}
                    </Text>
                  </View>
                </View>
              );
            })}

            {masSobrante && masSobrante.sobranteSoles > 0 ? (
              <Callout icon={TriangleAlert} style={styles.separado}>
                <Text style={styles.sobranteTexto} testID="resumen-sobrante">
                  {`Te sobró ${formatoSoles(
                    masSobrante.sobranteSoles,
                  )} en ${masSobrante.nombre.toLowerCase()}`}
                </Text>
              </Callout>
            ) : null}
          </Card>
        </View>
      ) : null}
    </>
  );
};

/**
 * El "te queda" de este ciclo contra el del anterior, con el monto del anterior debajo. El ícono
 * sube, baja o se queda igual y siempre acompaña a la frase; el texto va en letra oscura.
 */
const Comparacion = ({ actual, anterior }: { actual: ResumenCiclo; anterior: ResumenCiclo }) => {
  const perdio = actual.teQueda < anterior.teQueda;
  const igual = actual.teQueda === anterior.teQueda;
  return (
    <Card variant="bordered" style={styles.comparacion} testID="resumen-comparacion-fila">
      <View testID="resumen-comparacion-icono">
        {/* Igual no es ni bueno ni malo: el ícono va en un tono neutro. */}
        <Icon
          icon={perdio ? TrendingDown : igual ? Minus : TrendingUp}
          color={perdio ? 'danger' : igual ? 'textMuted' : 'success'}
          size="lg"
        />
      </View>
      <View style={styles.comparacionTextos}>
        <Text variant="bodyStrong" testID="resumen-comparacion">
          {compararCiclos(actual, anterior)}
        </Text>
        <Text variant="caption" color="textMuted" testID="resumen-comparacion-anterior">
          {`Resultado registrado anterior: ${formatoSoles(anterior.teQueda)}`}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  encabezado: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  contenido: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
  seccion: { gap: spacing.md },
  comparacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  comparacionTextos: { flex: 1 },
  separado: { marginTop: spacing.md },
  separadoChico: { marginTop: spacing.sm },
  // El rango de fechas baja a otra línea (o se parte) en vez de recortarse con fuente grande.
  filaCiclo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  rango: { flexShrink: 1 },
  filaCapital: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  cifraCapital: { flexShrink: 1 },
  barra: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pista: { flex: 1 },
  porcentaje: { minWidth: 56, textAlign: 'right' },
  sobranteTexto: { flex: 1 },
});
