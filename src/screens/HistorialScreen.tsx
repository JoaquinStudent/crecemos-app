// src/screens/HistorialScreen.tsx
// "Historial" (mock 03): qué pasó cada día, agrupado por día con el neto en el encabezado.
// Arriba, lo que dejó el mes. Cada fila lleva un círculo con su ícono (venta, Yape, gasto o por
// cobrar) y, bajo el monto, una palabra ("Ingreso", "Gasto", "Por cobrar"): el color nunca es la
// única señal (UX, regla 6). Tocar una fila abre la hoja del día con "Editar este día" y
// "Borrar este día" (SPEC-03: deslizar para editar o borrar queda fuera; el toque es la vía, UX regla 3).
import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  CalendarDays,
  Clock,
  List,
  Receipt,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ColorName, colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Badge, BadgeTone } from '@components/atoms/Badge';
import { Icon } from '@components/atoms/Icon';
import { MoneyText } from '@components/atoms/MoneyText';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { EmptyState } from '@components/molecules/EmptyState';
import { DiaSheet } from '@components/organisms/DiaSheet';
import { fechaLocal } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import { armarHistorial, resumenDelMes } from '@dominio/historial';
import type { Cierre, FiltroHistorial, GrupoDia, Movimiento } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';
import type { TabsParamList } from '@navigation/Tabs';

type HistorialNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Historial'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const FILTROS: readonly ChipOption<FiltroHistorial>[] = [
  { value: 'todo', label: 'Todo', icon: List },
  { value: 'ingresos', label: 'Ingresos', icon: ArrowUp, tone: 'success' },
  { value: 'gastos', label: 'Gastos', icon: ArrowDown, tone: 'danger' },
  { value: 'porCobrar', label: 'Por cobrar', icon: Clock, tone: 'warning' },
];

type Seccion = GrupoDia & { key: string; data: Movimiento[] };

// El signo va siempre, además del color (UX, regla 6): "+ S/ 168.00", "− S/ 244.00".
const conSigno = (n: number): string =>
  n === 0 ? formatoSoles(0) : `${n < 0 ? '−' : '+'} ${formatoSoles(Math.abs(n))}`;
const colorDe = (n: number): ColorName => (n > 0 ? 'success' : n < 0 ? 'danger' : 'textMuted');
const tonoDe = (n: number): BadgeTone => (n > 0 ? 'success' : n < 0 ? 'danger' : 'neutral');

/** Qué dibuja el círculo de una fila: un ícono y un par de colores (fondo suave + trazo). */
interface Marca {
  icono: LucideIcon;
  fondo: ColorName;
  trazo: ColorName;
}

/** El ícono es decorativo: la palabra de la fila ("Ingreso", "Gasto"…) lleva el significado. */
const marcaDe = (m: Movimiento): Marca => {
  if (m.porCobrar) return { icono: Clock, fondo: 'warningSoft', trazo: 'warning' };
  if (m.tipo === 'gasto') return { icono: Receipt, fondo: 'dangerSoft', trazo: 'danger' };
  if (m.metodo === 'Yape') return { icono: Smartphone, fondo: 'infoSoft', trazo: 'info' };
  return { icono: Banknote, fondo: 'successSoft', trazo: 'success' };
};

/** La palabra bajo el monto. */
export const tipoDe = (m: Movimiento): 'Ingreso' | 'Gasto' | 'Por cobrar' =>
  m.porCobrar ? 'Por cobrar' : m.tipo === 'gasto' ? 'Gasto' : 'Ingreso';

export const HistorialScreen = () => {
  const { cierres, cargando } = useCrecemos();
  const navigation = useNavigation<HistorialNavigation>();
  const [filtro, setFiltro] = useState<FiltroHistorial>('todo');
  // La hoja conserva el día aunque se cierre (para que no se vacíe mientras baja).
  const [enHoja, setEnHoja] = useState<Cierre | null>(null);
  const [hojaVisible, setHojaVisible] = useState(false);

  const secciones: Seccion[] = useMemo(
    () =>
      armarHistorial(cierres, filtro).map(g => ({ ...g, key: g.cierreId, data: g.movimientos })),
    [cierres, filtro],
  );
  const mes = useMemo(() => resumenDelMes(cierres, fechaLocal(new Date())), [cierres]);

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
        {!cargando && cierres.length > 0 ? <ResumenMes neto={mes.neto} dias={mes.dias} /> : null}
        {cierres.length > 0 ? (
          <ChipGroup
            options={FILTROS}
            value={filtro}
            onChange={setFiltro}
            testIDPrefix="filtro"
            layout="scroll"
            style={styles.filtros}
          />
        ) : null}
      </View>

      {cargando ? (
        <CargandoBloques style={styles.vacio} bloques={4} alto={64} testID="historial-cargando" />
      ) : cierres.length === 0 ? (
        <View style={styles.vacio}>
          <EmptyState
            title="Aún no cierras ningún día"
            text="Cuando cierres tu día, aquí vas a ver qué pasó cada día: lo que vendiste y lo que gastaste."
            actionLabel="Cerrar mi día"
            onAction={() => navigation.navigate('CerrarDia')}
            testID="historial-vacio"
            actionTestID="historial-cerrar-dia"
          />
        </View>
      ) : secciones.length === 0 ? (
        <View style={styles.vacio}>
          <EmptyState
            title="No hay nada con este filtro"
            text="Toca otro filtro para ver tus demás movimientos."
            testID="historial-sin-resultados"
          />
        </View>
      ) : (
        <SectionList<Movimiento, Seccion>
          sections={secciones}
          stickySectionHeadersEnabled
          keyExtractor={item => item.id}
          contentContainerStyle={styles.lista}
          testID="historial-lista"
          renderSectionHeader={({ section }) => (
            <View style={styles.diaEncabezado} testID={`dia-${section.cierreId}`}>
              <Text
                variant="labelStrong"
                color="textMuted"
                style={styles.diaTitulo}
                testID={`dia-titulo-${section.cierreId}`}
              >
                {section.titulo}
              </Text>
              {/* El neto del día, en una píldora: color + signo + cifra. */}
              <Badge
                label={conSigno(section.neto)}
                tone={tonoDe(section.neto)}
                labelTestID={`dia-neto-${section.cierreId}`}
              />
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const base = `fila-${section.cierreId}-${index}`;
            const marca = marcaDe(item);
            const tipo = tipoDe(item);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.etiqueta}${
                  item.metodo ? `, ${item.metodo}` : ''
                }, ${conSigno(item.monto)}, ${tipo}`}
                accessibilityHint="Toca para editar o borrar este día"
                onPress={() => abrirHoja(section.cierreId)}
                style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
                testID={base}
              >
                <View style={[styles.circulo, { backgroundColor: colors[marca.fondo] }]}>
                  <Icon icon={marca.icono} color={marca.trazo} size="md" />
                </View>
                <View style={styles.filaTexto}>
                  <Text variant="bodyStrong" numberOfLines={2} testID={`${base}-etiqueta`}>
                    {item.etiqueta}
                  </Text>
                  {item.metodo ? (
                    <Text variant="caption" color="textMuted" testID={`${base}-metodo`}>
                      {item.metodo}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.filaMonto}>
                  <Text
                    variant="h3"
                    color={colorDe(item.monto)}
                    numberOfLines={1}
                    testID={`${base}-monto`}
                  >
                    {conSigno(item.monto)}
                  </Text>
                  {/* La palabra: así el color no es lo único que distingue un ingreso de un gasto. */}
                  <Text
                    variant="caption"
                    color={item.porCobrar ? 'text' : 'textMuted'}
                    testID={item.porCobrar ? `${base}-por-cobrar` : `${base}-tipo`}
                  >
                    {tipo}
                  </Text>
                </View>
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

/** "Este mes · + S/ 1,240.00 ganados": lo que dejaron los días cerrados del mes. */
const ResumenMes = ({ neto, dias }: { neto: number; dias: number }) => (
  <View style={styles.resumen} testID="historial-periodo">
    <View style={styles.resumenIcono}>
      <Icon icon={CalendarDays} color="primary" size="md" />
    </View>
    <View style={styles.resumenTexto}>
      <Text variant="label" color="textMuted" testID="historial-periodo-titulo">
        Este mes
      </Text>
      {dias === 0 ? (
        <Text variant="bodySmall" color="textMuted" testID="historial-periodo-vacio">
          Aún no cierras días este mes
        </Text>
      ) : (
        <View style={styles.resumenMonto}>
          <MoneyText monto={neto} variant="h3" testID="historial-periodo-monto" />
          <Text variant="bodySmall" color="textMuted" testID="historial-periodo-palabra">
            {neto < 0 ? 'en rojo' : 'ganados'}
          </Text>
        </View>
      )}
    </View>
  </View>
);

const DIAMETRO_CIRCULO = 40;

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  // Los chips llegan al borde de la pantalla: el último asoma y avisa que hay más.
  filtros: { marginHorizontal: -spacing.lg },
  vacio: { padding: spacing.lg },
  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  resumenIcono: {
    width: DIAMETRO_CIRCULO,
    height: DIAMETRO_CIRCULO,
    borderRadius: DIAMETRO_CIRCULO / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumenTexto: { flex: 1 },
  resumenMonto: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm },
  lista: { paddingBottom: spacing.xl },
  // Fondo sólido: el encabezado queda fijo y las filas pasan por debajo.
  diaEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  diaTitulo: { flex: 1 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  filaPresionada: { backgroundColor: colors.surfacePressed },
  circulo: {
    width: DIAMETRO_CIRCULO,
    height: DIAMETRO_CIRCULO,
    borderRadius: DIAMETRO_CIRCULO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTexto: { flex: 1 },
  filaMonto: { flexShrink: 0, alignItems: 'flex-end', maxWidth: '45%' },
});
