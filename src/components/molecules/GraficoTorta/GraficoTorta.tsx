// src/components/molecules/GraficoTorta/GraficoTorta.tsx
// La torta de ventas por producto. Se dibuja con react-native-svg y solo recibe datos ya calculados
// (`porcionesTorta`). El color nunca va solo (regla 6 de UX): cada porción lleva un patrón distinto,
// la leyenda dice el nombre, el monto y el porcentaje en palabras, y el lector de pantalla oye la
// lista completa. El naranja es solo relleno; ningún texto lo usa.
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import {
  ESTILOS_TORTA,
  etiquetaTorta,
  textoPorcion,
  type EstiloPorcion,
  type PorcionTorta,
} from '@analisis/graficos';
import { formatoSoles } from '@dominio/formato';

export interface GraficoTortaProps {
  porciones: PorcionTorta[];
  testID?: string;
}

/** Lado del dibujo, en dp. */
const LADO = 160;
const RADIO = LADO / 2 - 4;
/** Lado del cuadradito de la leyenda, en dp. */
const LADO_MARCA = 20;
const TEXTO_VACIO = 'Aún no hay ventas en este periodo';

const estiloDe = (indice: number): EstiloPorcion => ESTILOS_TORTA[indice % ESTILOS_TORTA.length];

/** El relleno de una porción: el color y, encima, su marca. Un mosaico de 8 × 8. */
const Relleno = ({ id, indice }: { id: string; indice: number }) => {
  const e = estiloDe(indice);
  return (
    <Pattern id={id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <Rect width="8" height="8" fill={e.relleno} />
      {e.patron === 'rayas' ? (
        <Path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke={e.marca} strokeWidth="1.6" />
      ) : null}
      {e.patron === 'puntos' ? <Circle cx="4" cy="4" r="1.7" fill={e.marca} /> : null}
      {e.patron === 'cuadrícula' ? (
        <Path d="M0 4H8M4 0V8" stroke={e.marca} strokeWidth="1.2" />
      ) : null}
      {e.patron === 'líneas' ? <Path d="M0 2H8M0 6H8" stroke={e.marca} strokeWidth="1.4" /> : null}
    </Pattern>
  );
};

/** Las porciones del círculo, empezando arriba y en el sentido del reloj. */
const trozos = (porciones: PorcionTorta[]): string[] => {
  const total = porciones.reduce((suma, p) => suma + p.venta, 0);
  const centro = LADO / 2;
  let angulo = -Math.PI / 2;
  return porciones.map(p => {
    const barrido = (p.venta / total) * 2 * Math.PI;
    const x0 = centro + RADIO * Math.cos(angulo);
    const y0 = centro + RADIO * Math.sin(angulo);
    angulo += barrido;
    const x1 = centro + RADIO * Math.cos(angulo);
    const y1 = centro + RADIO * Math.sin(angulo);
    return `M${centro} ${centro}L${x0.toFixed(2)} ${y0.toFixed(2)}A${RADIO} ${RADIO} 0 ${
      barrido > Math.PI ? 1 : 0
    } 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
  });
};

export const GraficoTorta = ({ porciones, testID = 'grafico-torta' }: GraficoTortaProps) => {
  if (porciones.length === 0) {
    return (
      <Text color="textMuted" testID={`${testID}-vacio`}>
        {TEXTO_VACIO}
      </Text>
    );
  }
  const caminos = porciones.length > 1 ? trozos(porciones) : [];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={etiquetaTorta(porciones)}
      style={styles.contenedor}
      testID={testID}
    >
      <Svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`} testID={`${testID}-svg`}>
        <Defs>
          {porciones.map((p, i) => (
            <Relleno key={`d-${p.nombre}-${i}`} id={`${testID}-p${i}`} indice={i} />
          ))}
        </Defs>
        {porciones.length === 1 ? (
          <Circle
            cx={LADO / 2}
            cy={LADO / 2}
            r={RADIO}
            fill={`url(#${testID}-p0)`}
            stroke={colors.background}
            strokeWidth="2"
            testID={`${testID}-porcion-0`}
          />
        ) : (
          caminos.map((d, i) => (
            <Path
              key={`t-${porciones[i].nombre}-${i}`}
              d={d}
              fill={`url(#${testID}-p${i})`}
              stroke={colors.background}
              strokeWidth="2"
              testID={`${testID}-porcion-${i}`}
            />
          ))
        )}
      </Svg>

      <View style={styles.leyenda}>
        {porciones.map((p, i) => (
          <View key={`l-${p.nombre}-${i}`} style={styles.fila} testID={`${testID}-leyenda-${i}`}>
            <View
              style={styles.marca}
              accessibilityLabel={`Marca: ${estiloDe(i).patron}`}
              testID={`${testID}-marca-${i}`}
            >
              <Svg width={LADO_MARCA} height={LADO_MARCA} viewBox="0 0 16 16">
                <Defs>
                  <Relleno id={`${testID}-m${i}`} indice={i} />
                </Defs>
                <Rect width="16" height="16" fill={`url(#${testID}-m${i})`} />
              </Svg>
            </View>
            <View style={styles.textos}>
              <Text variant="bodySmall" testID={`${testID}-leyenda-texto-${i}`}>
                {textoPorcion(p)}
              </Text>
              <Text variant="bodyStrong" testID={`${testID}-monto-${i}`}>
                {formatoSoles(p.venta)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: spacing.lg },
  leyenda: { alignSelf: 'stretch', gap: spacing.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  marca: {
    width: LADO_MARCA,
    height: LADO_MARCA,
    borderWidth: 1,
    borderColor: colors.text,
  },
  textos: { flex: 1 },
});
