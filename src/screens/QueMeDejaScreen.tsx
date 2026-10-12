// src/screens/QueMeDejaScreen.tsx
// "Qué me deja cada uno" (mock 05): separa lo que se vende de lo que deja. Por producto, dos
// barras en la misma escala ("Se vende" y "Te deja") y su ganancia total en grande. Los números
// salen del dominio (`gananciaPorProducto`, `insight`): la pantalla solo los dibuja.
// No entran del mock: el selector "Lo que más dejó / Lo que más se vendió", la proyección en
// soles ni "Octubre · N ciclos" (el periodo son los últimos 30 días).
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lightbulb } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { ProgressBar } from '@components/atoms/ProgressBar';
import type { ProgressBarTone } from '@components/atoms/ProgressBar';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { EmptyState } from '@components/molecules/EmptyState';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { agruparCiclos } from '@dominio/ciclo';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import type { GananciaProducto, Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

/** El periodo que mira la pantalla: los últimos 30 días, contando el día 30. */
const DIAS_DEL_PERIODO = 30;

// Avance de una barra respecto de la mayor de su tipo (0 a 1): la mayor llega al 100 %.
const avance = (valor: number, mayor: number): number =>
  mayor > 0 ? Math.max(0, Math.round((valor / mayor) * 100)) / 100 : 0;

const unidadDe = (productos: Producto[], productoId: string): Producto['unidad'] =>
  productos.find(p => p.id === productoId)?.unidad ?? 'unidad';

const cantidadEnPalabras = (n: number, unidad: Producto['unidad']): string => {
  if (unidad === 'vaso') return `${n} ${n === 1 ? 'vaso' : 'vasos'}`;
  if (unidad === 'porcion') return `${n} ${n === 1 ? 'porción' : 'porciones'}`;
  const nombre = unidad.trim() || 'unidad';
  return `${n} ${n === 1 ? nombre : `${nombre}s`}`;
};

const periodoEnPalabras = (ciclos: number): string =>
  ciclos > 0
    ? `Últimos ${DIAS_DEL_PERIODO} días · ${ciclos} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`
    : `Últimos ${DIAS_DEL_PERIODO} días`;

export const QueMeDejaScreen = () => {
  const { cierres, productos, cargando } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'QueMeDeja'>>();

  const desde = restarDias(fechaLocal(new Date()), DIAS_DEL_PERIODO);
  const ganancias = useMemo(
    () => gananciaPorProducto(cierres, desde, productos),
    [cierres, desde, productos],
  );
  const ciclos = useMemo(
    () => agruparCiclos(cierres.filter(c => c.fecha >= desde)).length,
    [cierres, desde],
  );
  const frase = useMemo(() => insight(ganancias), [ganancias]);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']} testID="queme-pantalla">
      <ScrollView contentContainerStyle={styles.contenido}>
        <ScreenHeader
          title="Qué me deja cada uno"
          subtitle={periodoEnPalabras(ciclos)}
          onBack={() => navigation.goBack()}
          backTestID="queme-atras"
          subtitleTestID="queme-periodo"
        />

        {cargando ? (
          <CargandoBloques bloques={3} alto={140} testID="queme-cargando" />
        ) : ganancias.length === 0 ? (
          <EmptyState
            title="Todavía no hay días cerrados"
            text="Cierra tu día y aquí verás las unidades vendidas y la diferencia estimada por unidad de cada producto."
            actionLabel="Cerrar mi día"
            onAction={() => navigation.navigate('CerrarDia')}
            testID="queme-vacio"
            actionTestID="queme-cerrar-dia"
          />
        ) : (
          <>
            {frase ? (
              <Callout icon={Lightbulb} testID="queme-insight">
                <Text variant="bodyStrong" testID="queme-insight-texto">
                  {frase}
                </Text>
              </Callout>
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
          <Card
            key={g.productoId}
            variant="bordered"
            style={styles.tarjeta}
            testID={`queme-tarjeta-${g.productoId}`}
          >
            {vendes || deja ? (
              <View style={styles.etiquetas}>
                {vendes ? (
                  <View style={[styles.etiqueta, styles.etiquetaVendes]}>
                    <Text
                      variant="captionStrong"
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
                      variant="captionStrong"
                      style={styles.etiquetaTexto}
                      testID={`queme-etiqueta-deja-${g.productoId}`}
                    >
                      Mayor diferencia por unidad
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
              avance={avance(g.seVende, mayorVende)}
              tono="primary"
              idBarra={`queme-barra-vende-${g.productoId}`}
              idCifra={`queme-cifra-vende-${g.productoId}`}
              idEtiqueta={`queme-etiqueta-barra-vende-${g.productoId}`}
            />
            <FilaBarra
              etiqueta="Diferencia estimada total"
              cifra={formatoSoles(g.ganancia)}
              avance={avance(g.ganancia, mayorGanancia)}
              tono="success"
              idBarra={`queme-barra-deja-${g.productoId}`}
              idCifra={`queme-cifra-deja-${g.productoId}`}
              idEtiqueta={`queme-etiqueta-barra-deja-${g.productoId}`}
            />

            <Text variant="caption" color="textMuted" testID={`queme-detalle-${g.productoId}`}>
              {`${cantidadEnPalabras(
                g.seVende,
                unidad,
              )} · Diferencia estimada por unidad: ${formatoSoles(
                g.teDeja,
              )} (precio menos costo estimado)`}
            </Text>
          </Card>
        );
      })}
    </View>
  );
};

interface FilaBarraProps {
  etiqueta: string;
  cifra: string;
  /** 0 a 1, respecto de la mayor de su tipo. */
  avance: number;
  tono: ProgressBarTone;
  idBarra: string;
  idCifra: string;
  idEtiqueta?: string;
}

// La etiqueta va arriba, a todo el ancho (a 360 dp no cabe "Diferencia estimada total" en una
// columna angosta); debajo, la barra y su cifra en palabras al lado: ningún porcentaje suelto.
const FilaBarra = ({
  etiqueta,
  cifra,
  avance: avanceBarra,
  tono,
  idBarra,
  idCifra,
  idEtiqueta,
}: FilaBarraProps) => (
  <View style={styles.bloqueBarra}>
    <Text variant="label" color="textMuted" testID={idEtiqueta}>
      {etiqueta}
    </Text>
    <View style={styles.filaBarra}>
      <ProgressBar
        value={avanceBarra}
        accessibilityLabel={etiqueta}
        tone={tono}
        height={12}
        style={styles.pista}
        testID={idBarra}
      />
      <Text variant="label" style={styles.cifra} testID={idCifra}>
        {cifra}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  lista: { gap: spacing.md },
  tarjeta: { backgroundColor: colors.background, gap: spacing.sm },
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
  etiquetaTexto: { color: colors.text },
  filaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  nombre: { flex: 1 },
  bloqueBarra: { gap: spacing.xs },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  pista: { flex: 1 },
  // Sin ancho fijo: la cifra ocupa lo que necesita y la barra se queda con el resto.
  cifra: { flexShrink: 0, textAlign: 'right' },
});
