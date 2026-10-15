// src/components/molecules/GraficoUltimosDias/GraficoUltimosDias.tsx
// El resultado registrado de cada uno de los últimos 7, 14 o 30 días, una columna por día, hecha con
// View. Un día sin cierre es un hueco con contorno (no un cero) y la leyenda lo dice con palabras; un
// día en pérdida baja de la línea y su valor lleva el signo menos. Debajo, el mejor y el peor día en
// palabras: el color nunca va solo. El selector 7 / 14 / 30 son chips de 48 dp, con texto.
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { ChipGroup } from '@components/molecules/ChipGroup';
import type { DiaBarra, UltimosDias } from '@analisis/graficos';
import { formatoFecha, formatoFechaCorta, formatoSoles } from '@dominio/formato';

export type TramoDias = 7 | 14 | 30;

export interface GraficoUltimosDiasProps {
  datos: UltimosDias;
  tramo: TramoDias;
  onCambiarTramo: (tramo: TramoDias) => void;
  testID?: string;
}

export const TRAMOS: readonly { value: `${TramoDias}`; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
];

const TEXTO_VACIO = 'Aún no hay días cerrados en este periodo';
/** Alto de toda la zona de barras, en dp: lo positivo arriba y lo negativo abajo. */
const ALTO_ZONA = 120;
/** Alto mínimo de una barra con valor y alto del contorno de un hueco. */
const ALTO_MINIMO = 3;
const ALTO_HUECO = 8;

/**
 * Alto de lo positivo y de lo negativo, en dp, y los dp que vale un sol: el mayor llena su lado de
 * la zona. Lo positivo siempre deja lugar para el contorno de un hueco.
 */
export const medidasDeLaZona = (
  dias: DiaBarra[],
): { positivo: number; negativo: number; escala: number } => {
  const resultados = dias.flatMap(d => (d.resultado === null ? [] : [d.resultado]));
  const mayorPositivo = Math.max(0, ...resultados);
  const mayorNegativo = Math.max(0, ...resultados.map(r => -r));
  const suma = mayorPositivo + mayorNegativo;
  const minimo = ALTO_HUECO + ALTO_MINIMO;
  if (suma === 0) return { positivo: minimo, negativo: 0, escala: 0 };
  const escala = ALTO_ZONA / suma;
  return {
    positivo: Math.max(minimo, Math.round(mayorPositivo * escala)),
    negativo: Math.round(mayorNegativo * escala),
    escala,
  };
};

/** Alto de la barra de un día: proporcional a su valor, y nunca tan chica que no se vea. */
const altoDe = (resultado: number, escala: number): number =>
  Math.max(ALTO_MINIMO, Math.round(Math.abs(resultado) * escala));

const textoDia = (d: DiaBarra): string =>
  `${formatoFecha(d.fecha)}, ${formatoSoles(d.resultado ?? 0)}`;

export const GraficoUltimosDias = ({
  datos,
  tramo,
  onCambiarTramo,
  testID = 'grafico-dias',
}: GraficoUltimosDiasProps) => {
  const { dias, mejor, peor } = datos;
  const selector = (
    <ChipGroup
      label="Cuántos días mirar"
      options={TRAMOS}
      value={`${tramo}`}
      onChange={valor => onCambiarTramo(Number(valor) as TramoDias)}
      testIDPrefix={`${testID}-tramo`}
    />
  );
  if (dias.length === 0) {
    return (
      <View style={styles.contenedor} testID={testID}>
        {selector}
        <Text color="textMuted" testID={`${testID}-vacio`}>
          {TEXTO_VACIO}
        </Text>
      </View>
    );
  }

  const zona = medidasDeLaZona(dias);
  const huecos = dias.filter(d => d.resultado === null).length;
  const unico = mejor !== null && peor !== null && mejor.fecha === peor.fecha;
  const resumen =
    `Resultado registrado de los últimos ${dias.length} días. ${dias.length - huecos} con cierre` +
    (mejor && !unico ? `. Mejor día: ${textoDia(mejor)}` : '') +
    (peor && !unico ? `. Día más flojo: ${textoDia(peor)}` : '') +
    '.';

  return (
    <View style={styles.contenedor} testID={testID}>
      {selector}
      <View accessible accessibilityRole="image" accessibilityLabel={resumen}>
        <View style={styles.zona}>
          {dias.map(d => (
            <View key={d.fecha} style={styles.columna} testID={`${testID}-columna-${d.fecha}`}>
              <View style={[styles.lado, styles.ladoArriba, { height: zona.positivo }]}>
                {d.resultado === null ? (
                  <View style={styles.hueco} testID={`${testID}-hueco-${d.fecha}`} />
                ) : d.resultado >= 0 ? (
                  <View
                    style={[
                      styles.barra,
                      { height: altoDe(d.resultado, zona.escala), backgroundColor: colors.success },
                    ]}
                    testID={`${testID}-barra-${d.fecha}`}
                  />
                ) : null}
              </View>
              {zona.negativo > 0 ? (
                <View style={[styles.lado, styles.ladoAbajo, { height: zona.negativo }]}>
                  {d.resultado !== null && d.resultado < 0 ? (
                    <View
                      style={[
                        styles.barra,
                        {
                          height: altoDe(d.resultado, zona.escala),
                          backgroundColor: colors.danger,
                        },
                      ]}
                      testID={`${testID}-barra-${d.fecha}`}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.extremos}>
          <Text variant="caption" color="textMuted" testID={`${testID}-desde`}>
            {formatoFechaCorta(dias[0].fecha)}
          </Text>
          <Text variant="caption" color="textMuted" testID={`${testID}-hasta`}>
            {formatoFechaCorta(dias[dias.length - 1].fecha)}
          </Text>
        </View>
      </View>

      <Text variant="caption" color="textMuted" testID={`${testID}-leyenda`}>
        {huecos > 0
          ? 'Verde: día con resultado positivo. Rojo, bajo la línea: día en pérdida. Contorno vacío: día sin cierre.'
          : 'Verde: día con resultado positivo. Rojo, bajo la línea: día en pérdida.'}
      </Text>
      {mejor ? (
        <Text variant="bodySmall" testID={`${testID}-mejor`}>
          {unico ? `Único día cerrado: ${textoDia(mejor)}` : `Mejor día: ${textoDia(mejor)}`}
        </Text>
      ) : null}
      {peor && !unico ? (
        <Text variant="bodySmall" testID={`${testID}-peor`}>
          {`Día más flojo: ${textoDia(peor)}`}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.md },
  zona: { flexDirection: 'row', alignItems: 'stretch' },
  columna: { flex: 1, paddingHorizontal: 1 },
  lado: { alignItems: 'center' },
  // Lo positivo crece hacia arriba desde la línea; lo negativo, hacia abajo.
  ladoArriba: { justifyContent: 'flex-end' },
  ladoAbajo: { justifyContent: 'flex-start' },
  barra: { width: '80%', borderRadius: 2 },
  hueco: {
    width: '80%',
    height: ALTO_HUECO,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    borderRadius: 2,
  },
  extremos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
