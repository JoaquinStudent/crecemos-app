// src/screens/QueMeDejaScreen.tsx
// "Qué me deja cada uno" (mock 05): separa lo que se vende de lo que deja. Por producto, dos
// barras en la misma escala ("Se vende" y "Te deja") y su ganancia total en grande. Los números
// salen del dominio (`gananciaPorProducto`, `insight`): la pantalla solo los dibuja.
// No entran del mock: el selector "Lo que más dejó / Lo que más se vendió", la proyección en
// soles ni "Octubre · N ciclos" (el periodo son los últimos 30 días).
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lightbulb } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { agruparCiclos } from '@dominio/ciclo';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import type { GananciaProducto, Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

/** El periodo que mira la pantalla: los últimos 30 días, contando el día 30. */
const DIAS_DEL_PERIODO = 30;

// Ancho de una barra respecto de la mayor de su tipo: la mayor llega al 100 %.
const ancho = (valor: number, mayor: number): `${number}%` =>
  `${mayor > 0 ? Math.max(0, Math.round((valor / mayor) * 100)) : 0}%`;

const unidadDe = (productos: Producto[], productoId: string): 'porcion' | 'vaso' =>
  productos.find(p => p.id === productoId)?.unidad === 'vaso' ? 'vaso' : 'porcion';

const cantidadEnPalabras = (n: number, unidad: 'porcion' | 'vaso'): string => {
  if (unidad === 'vaso') return `${n} ${n === 1 ? 'vaso' : 'vasos'}`;
  return `${n} ${n === 1 ? 'porción' : 'porciones'}`;
};

const periodoEnPalabras = (ciclos: number): string =>
  ciclos > 0
    ? `Últimos ${DIAS_DEL_PERIODO} días · ${ciclos} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`
    : `Últimos ${DIAS_DEL_PERIODO} días`;

export const QueMeDejaScreen = () => {
  const { cierres, productos, cargando } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'QueMeDeja'>>();

  const desde = restarDias(fechaLocal(new Date()), DIAS_DEL_PERIODO);
  const ganancias = useMemo(() => gananciaPorProducto(cierres, desde), [cierres, desde]);
  const ciclos = useMemo(
    () => agruparCiclos(cierres.filter(c => c.fecha >= desde)).length,
    [cierres, desde],
  );
  const frase = useMemo(() => insight(ganancias), [ganancias]);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']} testID="queme-pantalla">
      <ScrollView contentContainerStyle={styles.contenido}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          onPress={() => navigation.goBack()}
          style={styles.atras}
          testID="queme-atras"
        >
          <Icon icon={ChevronLeft} color="primary" size="lg" />
          <Text variant="bodyStrong" color="primary">
            Atrás
          </Text>
        </Pressable>

        <View>
          <Text variant="h1" accessibilityRole="header">
            Qué me deja cada uno
          </Text>
          <Text variant="caption" color="textMuted" testID="queme-periodo">
            {periodoEnPalabras(ciclos)}
          </Text>
        </View>

        {cargando ? null : ganancias.length === 0 ? (
          <View style={styles.vacio} testID="queme-vacio">
            <Text variant="h3">Todavía no hay días cerrados</Text>
            <Text color="textMuted" style={styles.separado}>
              Cierra tu día y aquí vas a ver cuál de tus productos te deja más, no solo cuál se
              vende más.
            </Text>
            <Button
              title="Cerrar mi día"
              size="lg"
              fullWidth
              style={styles.separado}
              testID="queme-cerrar-dia"
              onPress={() => navigation.popTo('Tabs', { screen: 'CerrarDia' })}
            />
          </View>
        ) : (
          <>
            {frase ? (
              <View style={styles.insight} testID="queme-insight">
                <Icon icon={Lightbulb} color="accent" size="lg" />
                <Text variant="bodyStrong" style={styles.insightTexto} testID="queme-insight-texto">
                  {frase}
                </Text>
              </View>
            ) : null}

            <Tarjetas ganancias={ganancias} productos={productos} />

            <Text variant="caption" color="textMuted" align="center" testID="queme-nota">
              Calculado con lo que registraste. Mientras más cierres tus días, más preciso.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Tarjetas = ({
  ganancias,
  productos,
}: {
  ganancias: GananciaProducto[];
  productos: Producto[];
}) => {
  // Las dos barras usan la misma escala para todos los productos: la mayor de cada tipo es el 100 %.
  const mayorVende = Math.max(...ganancias.map(g => g.seVende));
  const mayorGanancia = Math.max(...ganancias.map(g => g.ganancia));
  // El que más se vende y el que más deja por porción, con los mismos desempates que `insight`
  // (el otro criterio, luego el nombre). Si son el mismo producto, esa tarjeta lleva las dos etiquetas.
  const conVentas = ganancias.filter(g => g.seVende > 0);
  const masVendido = [...conVentas].sort(
    (a, b) => b.seVende - a.seVende || b.teDeja - a.teDeja || a.nombre.localeCompare(b.nombre),
  )[0];
  const masDeja = [...conVentas].sort(
    (a, b) => b.teDeja - a.teDeja || b.seVende - a.seVende || a.nombre.localeCompare(b.nombre),
  )[0];

  return (
    <View style={styles.lista}>
      {ganancias.map(g => {
        const unidad = unidadDe(productos, g.productoId);
        const vendes = g.productoId === masVendido?.productoId;
        const deja = g.productoId === masDeja?.productoId;
        return (
          <View key={g.productoId} style={styles.tarjeta} testID={`queme-tarjeta-${g.productoId}`}>
            {vendes || deja ? (
              <View style={styles.etiquetas}>
                {vendes ? (
                  <View style={[styles.etiqueta, styles.etiquetaVendes]}>
                    <Text
                      variant="caption"
                      style={styles.etiquetaTexto}
                      testID={`queme-etiqueta-vendes-${g.productoId}`}
                    >
                      El que más vendes
                    </Text>
                  </View>
                ) : null}
                {deja ? (
                  <View style={[styles.etiqueta, styles.etiquetaDeja]}>
                    <Text
                      variant="caption"
                      style={styles.etiquetaTexto}
                      testID={`queme-etiqueta-deja-${g.productoId}`}
                    >
                      El que más te deja
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.filaEntre}>
              <Text variant="bodyStrong" style={styles.nombre}>
                {g.nombre}
              </Text>
              <Text variant="h3" color="success" testID={`queme-ganancia-${g.productoId}`}>
                {formatoSoles(g.ganancia)}
              </Text>
            </View>

            <FilaBarra
              etiqueta="Se vende"
              cifra={cantidadEnPalabras(g.seVende, unidad)}
              ancho={ancho(g.seVende, mayorVende)}
              relleno={colors.primary}
              fondo={colors.primarySoft}
              idBarra={`queme-barra-vende-${g.productoId}`}
              idCifra={`queme-cifra-vende-${g.productoId}`}
            />
            <FilaBarra
              etiqueta="Te deja"
              cifra={formatoSoles(g.ganancia)}
              ancho={ancho(g.ganancia, mayorGanancia)}
              relleno={colors.success}
              fondo={colors.successSoft}
              idBarra={`queme-barra-deja-${g.productoId}`}
              idCifra={`queme-cifra-deja-${g.productoId}`}
            />

            <Text variant="caption" color="textMuted" testID={`queme-detalle-${g.productoId}`}>
              {`${cantidadEnPalabras(g.seVende, unidad)} · ${formatoSoles(g.teDeja)} por ${
                unidad === 'vaso' ? 'vaso' : 'porción'
              }`}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

interface FilaBarraProps {
  etiqueta: string;
  cifra: string;
  ancho: `${number}%`;
  relleno: string;
  fondo: string;
  idBarra: string;
  idCifra: string;
}

// Etiqueta a la izquierda, la barra y su cifra en palabras al lado: ningún porcentaje suelto.
const FilaBarra = ({
  etiqueta,
  cifra,
  ancho: anchoBarra,
  relleno,
  fondo,
  idBarra,
  idCifra,
}: FilaBarraProps) => (
  <View style={styles.filaBarra}>
    <Text variant="label" color="textMuted" style={styles.etiquetaBarra}>
      {etiqueta}
    </Text>
    <View style={[styles.pista, { backgroundColor: fondo }]}>
      <View
        style={[styles.relleno, { width: anchoBarra, backgroundColor: relleno }]}
        testID={idBarra}
      />
    </View>
    <Text variant="label" style={styles.cifra} testID={idCifra}>
      {cifra}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  atras: {
    alignSelf: 'flex-start',
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  separado: { marginTop: spacing.md },
  vacio: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  insightTexto: { flex: 1 },
  lista: { gap: spacing.md },
  tarjeta: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  etiqueta: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  etiquetaVendes: { backgroundColor: colors.accentSoft },
  etiquetaDeja: { backgroundColor: colors.successSoft },
  // Letra oscura sobre fondo suave: el naranja nunca es el color del texto.
  etiquetaTexto: { color: colors.text, fontWeight: '600' },
  filaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  nombre: { flex: 1 },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  etiquetaBarra: { width: 72 },
  pista: { flex: 1, height: 12, borderRadius: radius.full, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.full },
  cifra: { minWidth: 92, textAlign: 'right' },
});
