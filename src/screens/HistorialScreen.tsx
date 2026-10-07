// src/screens/HistorialScreen.tsx
// "Historial" (mock 03): qué pasó cada día, agrupado por día con el neto en el encabezado.
// Tocar una fila abre la hoja del día con "Editar este día" y "Borrar este día" (SPEC-03:
// deslizar para editar o borrar queda fuera; el toque es la vía, UX regla 3).
import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ColorName, colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { DiaSheet } from '@components/organisms/DiaSheet';
import { formatoSoles } from '@dominio/formato';
import { armarHistorial } from '@dominio/historial';
import type { Cierre, FiltroHistorial, GrupoDia, Movimiento } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { TabsParamList } from '@navigation/Tabs';

const FILTROS: readonly ChipOption<FiltroHistorial>[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'porCobrar', label: 'Por cobrar' },
];

type Seccion = GrupoDia & { key: string; data: Movimiento[] };

// El signo va siempre, además del color (UX, regla 6): "+ S/ 168.00", "− S/ 244.00".
const conSigno = (n: number): string =>
  n === 0 ? formatoSoles(0) : `${n < 0 ? '−' : '+'} ${formatoSoles(Math.abs(n))}`;
const colorDe = (n: number): ColorName => (n > 0 ? 'success' : n < 0 ? 'danger' : 'textMuted');

export const HistorialScreen = () => {
  const { cierres, cargando } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList, 'Historial'>>();
  const [filtro, setFiltro] = useState<FiltroHistorial>('todo');
  // La hoja conserva el día aunque se cierre (para que no se vacíe mientras baja).
  const [enHoja, setEnHoja] = useState<Cierre | null>(null);
  const [hojaVisible, setHojaVisible] = useState(false);

  const secciones: Seccion[] = useMemo(
    () =>
      armarHistorial(cierres, filtro).map(g => ({ ...g, key: g.cierreId, data: g.movimientos })),
    [cierres, filtro],
  );

  const abrirHoja = (cierreId: string) => {
    const cierre = cierres.find(c => c.id === cierreId);
    if (!cierre) return;
    setEnHoja(cierre);
    setHojaVisible(true);
  };

  const editar = (fecha: string) => {
    setHojaVisible(false);
    navigation.navigate('CerrarDia', { fecha });
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.encabezado}>
        <Text variant="h1" accessibilityRole="header">
          Historial
        </Text>
        {cierres.length > 0 ? (
          <ChipGroup options={FILTROS} value={filtro} onChange={setFiltro} testIDPrefix="filtro" />
        ) : null}
      </View>

      {cargando ? null : cierres.length === 0 ? (
        <View style={styles.vacio}>
          <View style={styles.tarjeta} testID="historial-vacio">
            <Text variant="h3">Aún no cierras ningún día</Text>
            <Text color="textMuted" style={styles.separado}>
              Cuando cierres tu día, aquí vas a ver qué pasó cada día: lo que vendiste y lo que
              gastaste.
            </Text>
            <Button
              title="Cerrar mi día"
              size="lg"
              fullWidth
              style={styles.separado}
              testID="historial-cerrar-dia"
              onPress={() => navigation.navigate('CerrarDia')}
            />
          </View>
        </View>
      ) : secciones.length === 0 ? (
        <View style={styles.vacio}>
          <View style={styles.tarjeta} testID="historial-sin-resultados">
            <Text variant="h3">No hay nada con este filtro</Text>
            <Text color="textMuted" style={styles.separado}>
              Toca otro filtro para ver tus demás movimientos.
            </Text>
          </View>
        </View>
      ) : (
        <SectionList<Movimiento, Seccion>
          sections={secciones}
          stickySectionHeadersEnabled
          keyExtractor={(_, indice) => String(indice)}
          contentContainerStyle={styles.lista}
          testID="historial-lista"
          renderSectionHeader={({ section }) => (
            <View style={styles.diaEncabezado} testID={`dia-${section.cierreId}`}>
              <Text
                variant="label"
                color="textMuted"
                style={styles.diaTitulo}
                testID={`dia-titulo-${section.cierreId}`}
              >
                {section.titulo}
              </Text>
              <Text
                variant="label"
                color={colorDe(section.neto)}
                style={styles.diaTitulo}
                testID={`dia-neto-${section.cierreId}`}
              >
                {conSigno(section.neto)}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const base = `fila-${section.cierreId}-${index}`;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.etiqueta}${
                  item.metodo ? `, ${item.metodo}` : ''
                }, ${conSigno(item.monto)}`}
                accessibilityHint="Toca para editar o borrar este día"
                onPress={() => abrirHoja(section.cierreId)}
                style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
                testID={base}
              >
                <View style={styles.filaTexto}>
                  <Text variant="bodyStrong" testID={`${base}-etiqueta`}>
                    {item.etiqueta}
                  </Text>
                  {item.metodo || item.porCobrar ? (
                    <View style={styles.filaMetodo}>
                      {item.metodo ? (
                        <Text variant="caption" color="textMuted" testID={`${base}-metodo`}>
                          {item.metodo}
                        </Text>
                      ) : null}
                      {item.porCobrar ? (
                        <View style={styles.porCobrar}>
                          <Text variant="caption" color="text" testID={`${base}-por-cobrar`}>
                            Por cobrar
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Text variant="h3" color={colorDe(item.monto)} testID={`${base}-monto`}>
                  {conSigno(item.monto)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <DiaSheet
        cierre={enHoja}
        visible={hojaVisible}
        onClose={() => setHojaVisible(false)}
        onEditar={editar}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  vacio: { padding: spacing.lg },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  separado: { marginTop: spacing.md },
  lista: { paddingBottom: spacing.xl },
  // Fondo sólido: el encabezado queda fijo y las filas pasan por debajo.
  diaEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  diaTitulo: { fontWeight: '600' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  filaPresionada: { backgroundColor: colors.surfacePressed },
  filaTexto: { flex: 1 },
  filaMetodo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  porCobrar: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
