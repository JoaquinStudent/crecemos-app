// src/screens/CerrarDiaScreen.tsx
// El único formulario de cierre (RNF-12): porciones por producto (D1), Yape y gastos.
// Con el parámetro `fecha` es el modo edición: carga ese día y guardar lo reemplaza.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Plus } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { AmountInput } from '@components/molecules/AmountInput';
import { CantidadInput } from '@components/molecules/CantidadInput';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { calcularCierre, editarCierre, nuevoCierre } from '@dominio/cierre';
import { ETIQUETA_GASTO } from '@dominio/categorias';
import { fechaLocal } from '@dominio/fecha';
import { formatoFecha, formatoSoles, parseAmount } from '@dominio/formato';
import type { Cierre, CategoriaGasto, DatosCierre, Gasto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { TabsParamList } from '@navigation/Tabs';

// Una sola fuente para las categorías: ETIQUETA_GASTO (dominio).
const CATEGORIAS: readonly ChipOption<CategoriaGasto>[] = (
  Object.keys(ETIQUETA_GASTO) as CategoriaGasto[]
).map(value => ({ value, label: ETIQUETA_GASTO[value] }));

type Cantidades = Record<string, { preparadas: string; sobrantes: string }>;

const enteroDe = (texto: string) => (texto === '' ? 0 : parseInt(texto, 10));

export const CerrarDiaScreen = () => {
  const { productos, cierres, guardarDia } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList, 'CerrarDia'>>();
  const route = useRoute<RouteProp<TabsParamList, 'CerrarDia'>>();
  const activos = productos.filter(p => p.activo);

  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [yape, setYape] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('mercaderia');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [abreCiclo, setAbreCiclo] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Modo edición: llega la fecha de un día ya cerrado desde Historial.
  const fecha = route.params?.fecha;
  const original = fecha === undefined ? undefined : cierres.find(c => c.fecha === fecha);
  const hayOriginal = original !== undefined;
  const cierresRef = useRef(cierres);
  cierresRef.current = cierres;
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const vaciar = useCallback(() => {
    setCantidades({});
    setYape('');
    setMontoGasto('');
    setCategoria('mercaderia');
    setGastos([]);
    setAbreCiclo(false);
    setErrores({});
  }, []);

  const precargar = useCallback((c: Cierre) => {
    setCantidades(
      Object.fromEntries(
        c.lineas.map(l => [
          l.productoId,
          { preparadas: String(l.preparadas), sobrantes: String(l.sobrantes) },
        ]),
      ),
    );
    setYape(c.montoYape > 0 ? String(c.montoYape) : '');
    setMontoGasto('');
    setCategoria('mercaderia');
    setGastos(c.gastos);
    setAbreCiclo(c.abreCiclo);
    setErrores({});
  }, []);

  // Las pestañas siguen montadas: el formulario tiene que reaccionar al cambio del parámetro.
  // Con `fecha` carga ese día; sin ella (o si el día ya no existe) queda vacío, nunca con restos
  // de una edición anterior. Solo depende de la fecha y de que el día exista: guardar la edición
  // no la vuelve a disparar.
  useEffect(() => {
    const c = fecha === undefined ? undefined : cierresRef.current.find(x => x.fecha === fecha);
    if (c) {
      precargar(c);
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      return;
    }
    vaciar();
    if (fecha !== undefined) navigation.setParams({ fecha: undefined });
  }, [fecha, hayOriginal, navigation, precargar, vaciar]);

  // Solo van al cierre los productos en los que anotó algo; `ids` guarda el
  // producto de cada línea para ubicar los errores ('lineas.0.sobrantes').
  const ids = activos
    .map(p => p.id)
    .filter(
      id => (cantidades[id]?.preparadas ?? '') !== '' || (cantidades[id]?.sobrantes ?? '') !== '',
    );
  // Un monto escrito y no agregado también cuenta (spec01_e11): con el teclado
  // abierto, "Agregar gasto" queda tapado. Agregarlo vacía el campo, así que no se duplica.
  const pendiente = parseAmount(montoGasto);
  const datos: DatosCierre = {
    lineas: ids.map(id => ({
      productoId: id,
      preparadas: enteroDe(cantidades[id].preparadas),
      sobrantes: enteroDe(cantidades[id].sobrantes),
    })),
    montoYape: parseAmount(yape),
    gastos: pendiente > 0 ? [...gastos, { categoria, monto: pendiente }] : gastos,
    abreCiclo,
  };
  // En edición la vista previa usa los precios con que se cerró ese día (D2).
  const vista = original
    ? editarCierre(original, datos, productos, null, new Date())
    : nuevoCierre(datos, productos, null, new Date());
  const teQueda = calcularCierre(vista).teQueda;

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
      const resultado = await guardarDia(original ? { ...datos, fecha: original.fecha } : datos);
      if (!resultado.ok) {
        setErrores(resultado.errores);
        return;
      }
      vaciar();
      if (original) {
        navigation.setParams({ fecha: undefined });
        navigation.navigate('Historial');
      } else {
        navigation.navigate('Inicio');
      }
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    vaciar();
    navigation.setParams({ fecha: undefined });
    navigation.navigate('Historial');
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text variant="h1">Cerrar mi día</Text>
            <Text variant="label" color="textMuted" testID="cerrar-fecha">
              {original
                ? `Editando el ${formatoFecha(original.fecha).toLowerCase()}`
                : formatoFecha(fechaLocal(new Date()))}
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
              <View key={i} style={styles.gasto} testID={`gasto-${i}`}>
                <Text testID={`gasto-${i}-categoria`}>{ETIQUETA_GASTO[g.categoria]}</Text>
                <Text variant="bodyStrong" color="danger" testID={`gasto-${i}-monto`}>
                  − {formatoSoles(g.monto)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tarjeta}>
            <View style={styles.filaInterruptor}>
              <Text style={styles.etiquetaInterruptor}>Hoy compré mercadería</Text>
              <Switch
                value={abreCiclo}
                onValueChange={setAbreCiclo}
                trackColor={{ false: colors.disabled, true: colors.primary }}
                thumbColor={colors.background}
                accessibilityLabel="Hoy compré mercadería"
                testID="hoy-compre-mercaderia"
              />
            </View>
            <Text variant="caption" color="textMuted">
              Desde este día cuento un ciclo de compra nuevo.
            </Text>
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
            title={original ? 'Guardar los cambios' : 'Guardar mi día'}
            size="lg"
            fullWidth
            loading={guardando}
            onPress={guardar}
            testID="guardar-dia"
          />
          {original ? (
            <Button
              title="Cancelar"
              variant="ghost"
              fullWidth
              onPress={cancelarEdicion}
              testID="cancelar-edicion"
            />
          ) : null}
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
  filaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    gap: spacing.md,
  },
  etiquetaInterruptor: { flex: 1 },
  pie: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
