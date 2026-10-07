// src/screens/CerrarDiaScreen.tsx
// El único formulario de cierre (RNF-12): porciones por producto (D1), Yape y gastos.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Plus } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { AmountInput } from '@components/molecules/AmountInput';
import { CantidadInput } from '@components/molecules/CantidadInput';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { calcularCierre, nuevoCierre } from '@dominio/cierre';
import { fechaLocal } from '@dominio/fecha';
import { formatoSoles, parseAmount } from '@dominio/formato';
import type { CategoriaGasto, DatosCierre, Gasto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { TabsParamList } from '@navigation/Tabs';
import { fechaEnPalabras } from './fechaEnPalabras';

const CATEGORIAS: readonly ChipOption<CategoriaGasto>[] = [
  { value: 'mercaderia', label: 'Mercadería' },
  { value: 'carbon', label: 'Carbón' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'gas', label: 'Gas' },
  { value: 'otro', label: 'Otro' },
];

const nombreCategoria = (c: CategoriaGasto) => CATEGORIAS.find(o => o.value === c)?.label ?? c;

type Cantidades = Record<string, { preparadas: string; sobrantes: string }>;

const enteroDe = (texto: string) => (texto === '' ? 0 : parseInt(texto, 10));

export const CerrarDiaScreen = () => {
  const { productos, guardarDia } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const activos = productos.filter(p => p.activo);

  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [yape, setYape] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('mercaderia');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Solo van al cierre los productos en los que anotó algo; `ids` guarda el
  // producto de cada línea para ubicar los errores ('lineas.0.sobrantes').
  const ids = activos
    .map(p => p.id)
    .filter(
      id => (cantidades[id]?.preparadas ?? '') !== '' || (cantidades[id]?.sobrantes ?? '') !== '',
    );
  const datos: DatosCierre = {
    lineas: ids.map(id => ({
      productoId: id,
      preparadas: enteroDe(cantidades[id].preparadas),
      sobrantes: enteroDe(cantidades[id].sobrantes),
    })),
    montoYape: parseAmount(yape),
    gastos,
    abreCiclo: false,
  };
  const teQueda = calcularCierre(nuevoCierre(datos, productos, null, new Date())).teQueda;

  const errorDe = (productoId: string, campo: 'preparadas' | 'sobrantes') => {
    const i = ids.indexOf(productoId);
    return i === -1 ? undefined : errores[`lineas.${i}.${campo}`];
  };

  const cambiarCantidad = (id: string, campo: 'preparadas' | 'sobrantes', valor: string) =>
    setCantidades(previas => ({
      ...previas,
      [id]: { ...(previas[id] ?? { preparadas: '', sobrantes: '' }), [campo]: valor },
    }));

  const agregarGasto = () => {
    setGastos(previos => [...previos, { categoria, monto: parseAmount(montoGasto) }]);
    setMontoGasto('');
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const resultado = await guardarDia(datos);
      if (!resultado.ok) {
        setErrores(resultado.errores);
        return;
      }
      setCantidades({});
      setYape('');
      setMontoGasto('');
      setGastos([]);
      setErrores({});
      navigation.navigate('Inicio');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View>
            <Text variant="h1">Cerrar mi día</Text>
            <Text variant="label" color="textMuted">
              {fechaEnPalabras(fechaLocal(new Date()))}
            </Text>
          </View>

          <View style={styles.bloque}>
            <Text variant="h3">¿Cuánto preparaste y cuánto te sobró?</Text>
            {activos.map(p => (
              <View key={p.id} style={styles.tarjeta}>
                <Text variant="bodyStrong">
                  {p.nombre}{' '}
                  <Text variant="label" color="textMuted">
                    a {formatoSoles(p.precioVenta)}
                  </Text>
                </Text>
                <View style={styles.fila}>
                  <CantidadInput
                    label="Preparadas"
                    value={cantidades[p.id]?.preparadas ?? ''}
                    onChangeText={v => cambiarCantidad(p.id, 'preparadas', v)}
                    error={errorDe(p.id, 'preparadas')}
                    containerStyle={styles.columna}
                    testID={`preparadas-${p.id}`}
                  />
                  <CantidadInput
                    label="Sobrantes"
                    value={cantidades[p.id]?.sobrantes ?? ''}
                    onChangeText={v => cambiarCantidad(p.id, 'sobrantes', v)}
                    error={errorDe(p.id, 'sobrantes')}
                    containerStyle={styles.columna}
                    testID={`sobrantes-${p.id}`}
                  />
                </View>
              </View>
            ))}
          </View>

          <AmountInput
            label="¿Cuánto fue por Yape?"
            value={yape}
            onChangeText={setYape}
            error={errores.montoYape}
            testID="monto-yape"
          />

          <View style={styles.bloque}>
            <Text variant="h3">¿Gastaste algo hoy?</Text>
            <AmountInput
              label="Monto del gasto"
              value={montoGasto}
              onChangeText={setMontoGasto}
              testID="monto-gasto"
            />
            <ChipGroup
              label="¿En qué?"
              options={CATEGORIAS}
              value={categoria}
              onChange={setCategoria}
            />
            <Button
              title="Agregar gasto"
              variant="outline"
              leftIcon={Plus}
              fullWidth
              disabled={parseAmount(montoGasto) <= 0}
              onPress={agregarGasto}
              testID="agregar-gasto"
            />
            {gastos.map((g, i) => (
              <View key={i} style={styles.gasto}>
                <Text>{nombreCategoria(g.categoria)}</Text>
                <Text variant="bodyStrong" color="danger">
                  − {formatoSoles(g.monto)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.tarjeta, styles.teQueda]}>
            <Text variant="label">Te queda</Text>
            <Text
              variant="amount"
              color={teQueda < 0 ? 'danger' : 'success'}
              testID="cerrar-te-queda"
            >
              {formatoSoles(teQueda)}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.pie}>
          {errores.cierre ? (
            <Text color="danger" accessibilityLiveRegion="polite" testID="error-cierre">
              {errores.cierre}
            </Text>
          ) : null}
          <Button
            title="Guardar mi día"
            size="lg"
            fullWidth
            loading={guardando}
            onPress={guardar}
            testID="guardar-dia"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  bloque: { gap: spacing.md },
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  fila: { flexDirection: 'row', gap: spacing.md },
  columna: { flex: 1 },
  gasto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teQueda: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pie: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
