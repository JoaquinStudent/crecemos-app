// src/components/organisms/SelectorPeriodo/SelectorPeriodo.tsx
// El filtro de periodo de Resumen y de Mi reporte: un botón "Periodo: <etiqueta>" (con texto, 48 dp o
// más) que abre una hoja inferior con las opciones como chips, para alcanzarlo con el pulgar y sin
// teclado. Cada cambio se aplica al instante y "Listo" cierra la hoja. No guarda nada: el estado
// vive en la pantalla que lo usa. Sin selector de fecha nativo: los meses salen de los que tienen
// cierres, el más reciente primero.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { border, colors, radius, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { ChipGroup, type ChipOption } from '@components/molecules/ChipGroup';
import { etiquetaMesCorta, type FiltroPeriodo } from '@analisis/periodo';

export interface SelectorPeriodoProps {
  filtro: FiltroPeriodo;
  /** La etiqueta en palabras del periodo vigente (`Periodo.etiqueta`). */
  etiqueta: string;
  /** Los meses con cierres ('AAAA-MM'), el más reciente primero. */
  meses: string[];
  onChange: (filtro: FiltroPeriodo) => void;
  testID?: string;
}

type Opcion = FiltroPeriodo['tipo'];

export const OPCIONES: readonly ChipOption<Opcion>[] = [
  { value: 'todo', label: 'Todo el historial' },
  { value: 'esteMes', label: 'Este mes' },
  { value: 'mesPasado', label: 'Mes pasado' },
  { value: 'ultimos30', label: 'Últimos 30 días' },
  { value: 'mes', label: 'Elegir mes' },
  { value: 'rango', label: 'Rango de meses' },
];

export const SelectorPeriodo = ({
  filtro,
  etiqueta,
  meses,
  onChange,
  testID = 'selector-periodo',
}: SelectorPeriodoProps) => {
  const [abierto, setAbierto] = useState(false);
  const masReciente = meses[0];
  const masAntiguo = meses[meses.length - 1];
  const opcionesDeMes: ChipOption<string>[] = meses.map(m => ({
    value: m,
    label: etiquetaMesCorta(m),
  }));

  const elegir = (tipo: Opcion) => {
    if (tipo === 'mes') {
      onChange({ tipo, mes: filtro.tipo === 'mes' ? filtro.mes : masReciente });
    } else if (tipo === 'rango') {
      onChange(
        filtro.tipo === 'rango'
          ? filtro
          : { tipo, desde: masAntiguo ?? masReciente, hasta: masReciente },
      );
    } else {
      onChange({ tipo });
    }
  };

  return (
    <View testID={testID}>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`Periodo: ${etiqueta}. Cambiar`}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
        testID={`${testID}-boton`}
      >
        <Text variant="bodyStrong" style={styles.etiqueta} testID={`${testID}-etiqueta`}>
          {`Periodo: ${etiqueta}`}
        </Text>
        <Text variant="labelStrong" color="primary">
          Cambiar
        </Text>
      </Pressable>

      <BottomSheet
        visible={abierto}
        onClose={() => setAbierto(false)}
        accessibilityLabel="Elegir el periodo"
        footer={
          <Button
            title="Listo"
            size="lg"
            fullWidth
            onPress={() => setAbierto(false)}
            testID={`${testID}-listo`}
          />
        }
      >
        <Text variant="h3" accessibilityRole="header">
          ¿Qué periodo quieres ver?
        </Text>
        <ChipGroup
          options={OPCIONES}
          value={filtro.tipo}
          onChange={elegir}
          testIDPrefix={`${testID}-opcion`}
        />

        {filtro.tipo === 'mes' ? (
          <ChipGroup
            label="Elige el mes"
            options={opcionesDeMes}
            value={filtro.mes}
            onChange={mes => onChange({ tipo: 'mes', mes })}
            testIDPrefix={`${testID}-mes`}
          />
        ) : null}

        {filtro.tipo === 'rango' ? (
          <View style={styles.rango}>
            <ChipGroup
              label="Desde"
              options={opcionesDeMes}
              value={filtro.desde}
              onChange={desde => onChange({ ...filtro, desde })}
              testIDPrefix={`${testID}-desde`}
            />
            <ChipGroup
              label="Hasta"
              options={opcionesDeMes}
              value={filtro.hasta}
              onChange={hasta => onChange({ ...filtro, hasta })}
              testIDPrefix={`${testID}-hasta`}
            />
          </View>
        ) : null}

        <Text variant="bodySmall" color="textMuted" testID={`${testID}-ayuda`}>
          {`Ahora ves: ${etiqueta}.`}
        </Text>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: size.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: border.thick,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  presionado: { backgroundColor: colors.primarySoft },
  etiqueta: { flex: 1 },
  rango: { gap: spacing.lg },
});
