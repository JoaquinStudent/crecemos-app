// src/components/organisms/InteligenciaReporte/InteligenciaReporte.tsx
// La vista previa, en pantalla, de las páginas de inteligencia de negocio del reporte: lo mismo que
// el PDF y el texto, con las mismas frases (`frasesInteligencia`). Solo dibuja datos ya calculados:
// totales por mes, por producto y por día de la semana; nunca un cierre suelto con su fecha.
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { BarrasPorMes } from '@components/molecules/BarrasPorMes';
import { GraficoTorta } from '@components/molecules/GraficoTorta';
import {
  diasCerradosTexto,
  fraseDiaMasVentas,
  fraseDiaQueMasDeja,
  fraseDiaQueMenosDeja,
  fraseMesFuerte,
  fraseProductoEstrella,
  NOTA_SIN_DIAS_SEMANA,
} from '@analisis/frasesInteligencia';
import { ultimosMeses, type Inteligencia } from '@analisis/inteligencia';
import { formatoSoles } from '@dominio/formato';

export interface InteligenciaReporteProps {
  inteligencia: Inteligencia;
  etiquetaPeriodo: string;
  testID?: string;
}

/** Cuántos meses dibujan las barras de la hoja (la tabla del PDF lleva más). */
const MESES_EN_BARRAS = 6;
const COMPARACIONES_EN_PANTALLA = 3;

const Dato = ({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID: string }) => (
  <View style={styles.dato}>
    <Text variant="bodySmall" color="textMuted" style={styles.etiquetaDato}>
      {etiqueta}
    </Text>
    <Text variant="bodyStrong" align="right" style={styles.valorDato} testID={testID}>
      {valor}
    </Text>
  </View>
);

export const InteligenciaReporte = ({
  inteligencia: i,
  etiquetaPeriodo,
  testID = 'reporte-inteligencia',
}: InteligenciaReporteProps) => {
  const estrella = fraseProductoEstrella(i);
  return (
    <View style={styles.hoja} testID={testID}>
      <Text variant="labelStrong" color="primary" style={styles.marca}>
        Inteligencia de negocio
      </Text>
      <Text variant="bodyStrong" testID={`${testID}-periodo`}>
        {`${etiquetaPeriodo} · ${diasCerradosTexto(i.dias)}`}
      </Text>

      {!i.hayDatos ? (
        <Text color="textMuted" testID={`${testID}-vacio`}>
          Sin días cerrados en este periodo.
        </Text>
      ) : (
        <>
          <View style={styles.linea} />
          <Dato
            etiqueta="Ventas del periodo"
            valor={formatoSoles(i.venta)}
            testID="reporte-intel-venta"
          />
          <Dato
            etiqueta="Gastos del periodo"
            valor={formatoSoles(i.gastos)}
            testID="reporte-intel-gastos"
          />
          <Dato
            etiqueta="Resultado registrado"
            valor={formatoSoles(i.resultado)}
            testID="reporte-intel-resultado"
          />
          <Dato
            etiqueta="Promedio por día cerrado"
            valor={`${formatoSoles(i.promedioVentaDia)} en ventas`}
            testID="reporte-intel-promedio"
          />

          <View style={styles.linea} />
          <Text variant="labelStrong">Ventas, gastos y resultado registrado por mes</Text>
          <BarrasPorMes
            meses={ultimosMeses(i.meses, MESES_EN_BARRAS)}
            testID="reporte-intel-grafico-meses"
          />

          <View style={styles.linea} />
          <Text variant="labelStrong">Mes más fuerte y mes más débil</Text>
          {i.mesMasFuerte && i.mesMasDebil ? (
            <>
              <Text variant="bodySmall" testID="reporte-intel-fuerte">
                {`Mes más fuerte: ${fraseMesFuerte(i.mesMasFuerte)}`}
              </Text>
              <Text variant="bodySmall" testID="reporte-intel-debil">
                {`Mes más débil: ${fraseMesFuerte(i.mesMasDebil)}`}
              </Text>
            </>
          ) : (
            <Text variant="bodySmall" color="textMuted" testID="reporte-intel-nota-meses">
              {i.notaMeses ?? ''}
            </Text>
          )}

          <View style={styles.linea} />
          <Text variant="labelStrong">Comparación entre meses</Text>
          {i.comparaciones.length === 0 ? (
            <Text variant="bodySmall" color="textMuted" testID="reporte-intel-sin-comparacion">
              No hay dos meses seguidos con días cerrados para comparar.
            </Text>
          ) : (
            i.comparaciones.slice(-COMPARACIONES_EN_PANTALLA).map(c => (
              <Text variant="bodySmall" key={c.mes} testID={`reporte-intel-comparacion-${c.mes}`}>
                {c.frase}
              </Text>
            ))
          )}

          <View style={styles.linea} />
          <Text variant="labelStrong">Días de la semana</Text>
          {i.diaMasVentas ? (
            <Text variant="bodySmall" testID="reporte-intel-dia-ventas">
              {`Día que más vendes: ${fraseDiaMasVentas(i.diaMasVentas)}`}
            </Text>
          ) : null}
          {i.diaQueMasDeja ? (
            <Text variant="bodySmall" testID="reporte-intel-dia-mas-deja">
              {`Día que más deja: ${fraseDiaQueMasDeja(i.diaQueMasDeja)}`}
            </Text>
          ) : null}
          {i.diaQueMenosDeja ? (
            <Text variant="bodySmall" testID="reporte-intel-dia-menos-deja">
              {`Día que menos deja: ${fraseDiaQueMenosDeja(i.diaQueMenosDeja)}`}
            </Text>
          ) : null}
          {!i.diaMasVentas && !i.diaQueMasDeja && !i.diaQueMenosDeja ? (
            <Text variant="bodySmall" color="textMuted" testID="reporte-intel-sin-dias">
              {NOTA_SIN_DIAS_SEMANA}
            </Text>
          ) : null}

          <View style={styles.linea} />
          <Text variant="labelStrong">Producto estrella</Text>
          {estrella ? (
            <Text variant="bodySmall" testID="reporte-intel-estrella">
              {estrella}
            </Text>
          ) : null}
          <GraficoTorta porciones={i.torta} testID="reporte-intel-torta" />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hoja: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  marca: { letterSpacing: 0.5 },
  linea: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  etiquetaDato: { flex: 1 },
  valorDato: { flexShrink: 1, maxWidth: '58%' },
});
