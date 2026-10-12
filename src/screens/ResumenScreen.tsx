// src/screens/ResumenScreen.tsx
// "Resumen" (mock 04): el ciclo de compra actual. "El primer día es para el capital y el
// segundo es la ganancia" dibujado como una barra, y cuánto de la mercadería se vendió.
// Con 2 ciclos o más, una fila compara con el ciclo anterior: el texto y el monto, nunca solo un
// porcentaje. Termina con los botones a "Qué me deja cada uno", "Mi reporte" y "Preguntarle a mis
// datos" (la pestaña Asistente). Sin "Este mes / Todo", sin gráfico de ciclos y sin buscar.
// Las barras son Views de ancho porcentual, sin librerías.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { ProgressBar } from '@components/atoms/ProgressBar';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { EmptyState } from '@components/molecules/EmptyState';
import { compararCiclos } from '@analisis/metricas';
import { agruparCiclos, mercaderiaDelCiclo, resumirCiclo, textoCapital } from '@dominio/ciclo';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import type { Ciclo, Producto, ResumenCiclo } from '@dominio/tipos';
import { unidadSegunCantidad } from '@dominio/unidades';
import { useCrecemos } from '@context/CrecemosProvider';
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

export const ResumenScreen = () => {
  const { cierres, productos, cargando } = useCrecemos();
  const navigation = useNavigation<ResumenNavigation>();

  // El ciclo actual es el último.
  const ciclos = agruparCiclos(cierres);
  const actual = ciclos.length > 0 ? ciclos[ciclos.length - 1] : null;
  const anterior = ciclos.length > 1 ? ciclos[ciclos.length - 2] : null;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text variant="h1" accessibilityRole="header">
          Resumen
        </Text>

        {cargando ? (
          <CargandoBloques bloques={3} alto={120} testID="resumen-cargando" />
        ) : actual ? (
          <CicloActual ciclo={actual} anterior={anterior} productos={productos} />
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
              onPress={() => navigation.navigate('MiReporte')}
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

const CicloActual = ({
  ciclo,
  anterior,
  productos,
}: {
  ciclo: Ciclo;
  anterior: Ciclo | null;
  productos: Producto[];
}) => {
  const resumen = resumirCiclo(ciclo);
  const mercaderia = mercaderiaDelCiclo(ciclo, productos);

  // La ganancia es lo que te queda mientras sea positivo; si vendió menos que su capital, no hay.
  const ganancia = Math.max(resumen.teQueda, 0);
  const total = resumen.capital + ganancia;
  const capitalPorcentaje = porcentaje(resumen.capital, total);

  // Lo que más plata dejó sin vender; en un empate, el primero por nombre.
  const masSobrante = mercaderia.reduce<(typeof mercaderia)[number] | null>(
    (mayor, m) => (m.sobranteSoles > (mayor?.sobranteSoles ?? 0) ? m : mayor),
    null,
  );

  return (
    <>
      <Card>
        <View style={styles.filaEntre}>
          <Text variant="label" color="textMuted">
            Ciclo actual
          </Text>
          <Text variant="label" color="textMuted" testID="resumen-rango">
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
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {formatoSoles(resumen.teQueda)}
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
          >
            {`Capital ${formatoSoles(resumen.capital)}`}
          </Text>
          <Text
            variant="bodyStrong"
            color="success"
            style={styles.cifraCapital}
            testID="resumen-ganancia"
          >
            {`Resultado positivo ${formatoSoles(ganancia)}`}
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

      {anterior ? <Comparacion actual={resumen} anterior={resumirCiclo(anterior)} /> : null}

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
  contenido: { padding: spacing.lg, gap: spacing.xl },
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
  filaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
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
