// src/screens/ResumenScreen.tsx
// "Resumen" (mock 04): el ciclo de compra actual. "El primer día es para el capital y el
// segundo es la ganancia" dibujado como una barra, y cuánto de la mercadería se vendió.
// Sin comparación con el ciclo anterior (es del Sprint-05), sin "Este mes / Todo", sin
// gráfico de ciclos y sin buscar. Las barras son Views de ancho porcentual, sin librerías.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { agruparCiclos, mercaderiaDelCiclo, resumirCiclo, textoCapital } from '@dominio/ciclo';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import type { Ciclo } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { TabsParamList } from '@navigation/Tabs';

// Por debajo de este porcentaje vendido, la barra de un producto va en naranja (solo relleno).
const VENDIDO_MINIMO = 70;

const porcentaje = (parte: number, total: number): number =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

const rango = (ciclo: Ciclo): string =>
  ciclo.inicio === ciclo.fin
    ? formatoFechaCorta(ciclo.inicio)
    : `${formatoFechaCorta(ciclo.inicio)} — ${formatoFechaCorta(ciclo.fin)}`;

export const ResumenScreen = () => {
  const { cierres, cargando } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList, 'Resumen'>>();

  // El ciclo actual es el último.
  const ciclos = agruparCiclos(cierres);
  const actual = ciclos.length > 0 ? ciclos[ciclos.length - 1] : null;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text variant="h1" accessibilityRole="header">
          Resumen
        </Text>

        {cargando ? null : actual ? (
          <CicloActual ciclo={actual} />
        ) : (
          <View style={styles.tarjeta} testID="resumen-vacio">
            <Text variant="h3">Aún no cierras ningún día</Text>
            <Text color="textMuted" style={styles.separado}>
              Cuando cierres tu día, aquí vas a ver cuánto te queda de tu ciclo de compra y cuánto
              vendiste de tu mercadería.
            </Text>
            <Button
              title="Cerrar mi día"
              size="lg"
              fullWidth
              style={styles.separado}
              testID="resumen-cerrar-dia"
              onPress={() => navigation.navigate('CerrarDia')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const CicloActual = ({ ciclo }: { ciclo: Ciclo }) => {
  const resumen = resumirCiclo(ciclo);
  const mercaderia = mercaderiaDelCiclo(ciclo);

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
      <View style={styles.tarjeta}>
        <View style={styles.filaEntre}>
          <Text variant="label" color="textMuted">
            Ciclo actual
          </Text>
          <Text variant="label" color="textMuted" testID="resumen-rango">
            {rango(ciclo)}
          </Text>
        </View>

        <Text variant="bodyStrong" style={styles.separado}>
          Te queda
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

        {total > 0 ? (
          <View style={[styles.barra, styles.separado]} testID="resumen-barra">
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
        <View style={[styles.filaEntre, styles.separadoChico]}>
          <Text variant="bodyStrong" color="danger" testID="resumen-capital">
            {`Capital ${formatoSoles(resumen.capital)}`}
          </Text>
          <Text variant="bodyStrong" color="success" testID="resumen-ganancia">
            {`Ganancia ${formatoSoles(ganancia)}`}
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
      </View>

      {mercaderia.length > 0 ? (
        <View style={styles.seccion}>
          <Text variant="h3">Tu mercadería</Text>
          <View style={styles.tarjeta}>
            {mercaderia.map((m, i) => {
              const vendido = porcentaje(m.vendidas, m.preparadas);
              const bien = vendido >= VENDIDO_MINIMO;
              const base = `mercaderia-${m.productoId}`;
              return (
                <View key={m.productoId} style={i > 0 ? styles.separado : undefined} testID={base}>
                  <Text testID={`${base}-texto`}>
                    {`${m.nombre} — vendiste ${m.vendidas} de ${m.preparadas} ${
                      m.preparadas === 1 ? 'porción' : 'porciones'
                    }`}
                  </Text>
                  <View style={[styles.filaBarra, styles.separadoChico]}>
                    <View style={styles.pista}>
                      <View
                        style={[
                          styles.relleno,
                          {
                            width: `${vendido}%`,
                            backgroundColor: bien ? colors.success : colors.accent,
                          },
                        ]}
                        testID={`${base}-barra`}
                      />
                    </View>
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
              <View style={[styles.sobrante, styles.separado]}>
                <Icon icon={TriangleAlert} color="accent" />
                <Text style={styles.sobranteTexto} testID="resumen-sobrante">
                  {`Te sobró ${formatoSoles(
                    masSobrante.sobranteSoles,
                  )} en ${masSobrante.nombre.toLowerCase()}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  seccion: { gap: spacing.md },
  separado: { marginTop: spacing.md },
  separadoChico: { marginTop: spacing.sm },
  filaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  barra: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pista: {
    flex: 1,
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  relleno: { height: '100%' },
  porcentaje: { minWidth: 56, textAlign: 'right' },
  sobrante: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  sobranteTexto: { flex: 1 },
});
