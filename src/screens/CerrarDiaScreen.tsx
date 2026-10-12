// src/screens/CerrarDiaScreen.tsx
// El único formulario de cierre (RNF-12): porciones por producto (D1), Yape y gastos.
// Con el parámetro `fecha` es el modo edición: carga ese día y guardar lo reemplaza.
// Es un modal del stack raíz (no una pestaña): al guardar NO se cierra solo, muestra "Tu día
// quedó cuadrado" con el resultado y un único botón "Listo" (UX, regla 9: nada desaparece solo).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircleCheck, PiggyBank, Plus } from 'lucide-react-native';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { MoneyText } from '@components/atoms/MoneyText';
import { AmountInput } from '@components/molecules/AmountInput';
import { CantidadInput } from '@components/molecules/CantidadInput';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { StickyFooter } from '@components/molecules/StickyFooter';
import { calcularCierre, crearId, editarCierre, nuevoCierre } from '@dominio/cierre';
import { ETIQUETA_GASTO } from '@dominio/categorias';
import { fechaLocal } from '@dominio/fecha';
import { formatoFecha, formatoSoles, parseAmount, redondearSoles } from '@dominio/formato';
import { totalDelDia, yapesDeFecha } from '@dominio/yape';
import { estado as estadoDeMeta, sugerenciaDeHoy, teQuedaDelUltimoCierre } from '@dominio/meta';
import type { Cierre, CategoriaGasto, DatosCierre, Gasto } from '@dominio/tipos';
import { MensajeError } from '@components/atoms/MensajeError';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

// Una sola fuente para las categorías: ETIQUETA_GASTO (dominio).
const CATEGORIAS: readonly ChipOption<CategoriaGasto>[] = (
  Object.keys(ETIQUETA_GASTO) as CategoriaGasto[]
).map(value => ({ value, label: ETIQUETA_GASTO[value] }));

// Cada gasto agregado lleva un id propio para poder quitarlo sin depender de su posición.
type GastoEnForm = Gasto & { id: string };

const conId = (g: Gasto): GastoEnForm => ({ ...g, id: crearId() });

/** Lo que muestra la pantalla de éxito: el resultado del día recién guardado. */
interface Exito {
  teQueda: number;
  venta: number;
  gastoTotal: number;
}

type Cantidades = Record<string, { preparadas: string; sobrantes: string }>;

const enteroDe = (texto: string) => (texto === '' ? 0 : parseInt(texto, 10));

export const CerrarDiaScreen = () => {
  const { productos, cierres, guardarDia, meta, aportarAMeta, yapes } =
    useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'CerrarDia'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CerrarDia'>>();

  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [yape, setYape] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('mercaderia');
  const [gastos, setGastos] = useState<GastoEnForm[]>([]);
  const [abreCiclo, setAbreCiclo] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<Exito | null>(null);
  // Lo que separó para su cuota desde la pantalla de éxito (null = todavía nada).
  // `true` si el monto de Yape ya incluye los yapes anotados de esta fecha (se consumen al guardar).
  const [sumados, setSumados] = useState(false);
  const [separado, setSeparado] = useState<number | null>(null);

  // Modo edición: llega la fecha de un día ya cerrado desde Historial.
  const fecha = route.params?.fecha;
  // Sin `fecha` el objetivo es hoy: si hoy ya está cerrado se edita ese cierre, nunca se crea uno en blanco.
  const hoy = fechaLocal(new Date());
  const original = cierres.find(c => c.fecha === (fecha ?? hoy));
  const editandoHoy = fecha === undefined && original !== undefined;
  // Al editar un cierre antiguo se puede conservar una línea de un producto hoy inactivo.
  const activos = productos.filter(p => p.activo || original?.lineas.some(l => l.productoId === p.id));
  const hayOriginal = original !== undefined;
  const cierresRef = useRef(cierres);
  cierresRef.current = cierres;
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const yapesRef = useRef(yapes);
  yapesRef.current = yapes;
  // Los yapes anotados del día que se está cerrando (o editando).
  const fechaObjetivo = original?.fecha ?? fecha ?? hoy;
  const anotados = yapesDeFecha(yapes, fechaObjetivo);
  const sumaAnotados = totalDelDia(yapes, fechaObjetivo);

  const vaciar = useCallback(() => {
    setCantidades({});
    setYape('');
    setMontoGasto('');
    setCategoria('mercaderia');
    setGastos([]);
    setAbreCiclo(false);
    setErrores({});
    setSumados(false);
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
    setGastos(c.gastos.map(conId));
    setAbreCiclo(c.abreCiclo);
    setErrores({});
    setSumados(false);
  }, []);

  // Al abrir el modal se carga lo que corresponda: con `fecha`, ese día; sin ella, el cierre de
  // hoy si ya existe. Si no hay nada que cargar queda vacío. Solo depende de la fecha y de que el
  // día exista: guardar la edición no la vuelve a disparar. El modal se desmonta al cerrarse, así
  // que nunca queda una edición vieja a medias ni "hoy" de ayer.
  const sincronizar = useCallback(() => {
    const objetivo = fecha ?? fechaLocal(new Date());
    const c = cierresRef.current.find(x => x.fecha === objetivo);
    if (c) {
      precargar(c);
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      return;
    }
    vaciar();
    // Cierre nuevo con yapes anotados: el Yape ya viene sumado (se puede cambiar).
    const anotadosDelDia = yapesDeFecha(yapesRef.current, objetivo);
    if (anotadosDelDia.length > 0) {
      setYape(String(totalDelDia(yapesRef.current, objetivo)));
      setSumados(true);
    }
  }, [fecha, precargar, vaciar]);

  useEffect(() => {
    sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, hayOriginal]);

  // Al editar un día se muestra el precio con que se vendió ese día, no el de hoy (D2).
  const precioDe = (productoId: string, vigente: number) =>
    original?.lineas.find(l => l.productoId === productoId)?.precioUnitario ?? vigente;

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
    gastos: [
      ...gastos.map(({ categoria: cat, monto }) => ({ categoria: cat, monto })),
      ...(pendiente > 0 ? [{ categoria, monto: pendiente }] : []),
    ],
    abreCiclo,
  };
  // En edición la vista previa usa los precios con que se cerró ese día (D2).
  const vista = original
    ? editarCierre(original, datos, productos, null, new Date())
    : nuevoCierre(datos, productos, null, new Date());
  const resumenVista = calcularCierre(vista);
  const teQueda = resumenVista.teQueda;

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
    setGastos(previos => [...previos, conId({ categoria, monto: parseAmount(montoGasto) })]);
    setMontoGasto('');
  };

  // Día ya cerrado: los yapes anotados se suman solo si la persona lo pide (no se cuenta dos veces).
  const sumarAnotados = () => {
    setYape(String(redondearSoles(parseAmount(yape) + sumaAnotados)));
    setSumados(true);
  };

  const quitarGasto = (id: string) => setGastos(previos => previos.filter(g => g.id !== id));

  const { ejecutar: guardar, ejecutando: guardando, mensajeError } = useAccionSegura(async () => {
    const resultado = await guardarDia(
      original ? { ...datos, fecha: original.fecha } : datos,
      sumados ? { consumirYapesDe: fechaObjetivo } : undefined,
    );
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    setExito({
      teQueda: resumenVista.teQueda,
      venta: resumenVista.venta,
      gastoTotal: resumenVista.gastoTotal,
    });
    try {
      Vibration.vibrate(10);
    } catch {
      // Sin vibración (o sin permiso) no pasa nada: es solo una confirmación táctil.
    }
  });

  const sugerenciaMeta = meta
    ? sugerenciaDeHoy(meta, hoy, teQuedaDelUltimoCierre(cierres))
    : null;
  const { ejecutar: separarParaCuota, ejecutando: separando, mensajeError: errorSeparar } =
    useAccionSegura(async () => {
      if (!sugerenciaMeta) return;
      const resultado = await aportarAMeta(sugerenciaMeta.monto);
      if (resultado.ok) setSeparado(sugerenciaMeta.monto);
    });

  const cerrar = () => navigation.goBack();

  if (exito) {
    return (
      <SafeAreaView style={styles.pantalla} edges={['top']} testID="cierre-exito">
        <View style={styles.exito}>
          <Icon icon={CircleCheck} color="success" size={64} />
          <Text variant="h1" align="center" accessibilityRole="header" testID="cierre-exito-titulo">
            Tu día quedó cuadrado
          </Text>
          <View style={styles.exitoMonto}>
            <Text variant="label" color="textMuted">
              Te queda
            </Text>
            <MoneyText monto={exito.teQueda} variant="hero" testID="cierre-exito-te-queda" />
            <Text variant="caption" color="textMuted" align="center">
              Ventas menos gastos registrados. No equivale al efectivo recibido.
            </Text>
          </View>
          <Text align="center" testID="cierre-exito-resumen">
            {`Vendiste ${formatoSoles(exito.venta)} · Gastaste ${formatoSoles(exito.gastoTotal)}`}
          </Text>
          {/* Separar para la cuota es opcional y no cierra nada: el único principal sigue siendo "Listo". */}
          {meta && estadoDeMeta(meta, hoy) !== 'cumplida' ? (
            separado !== null ? (
              <Text variant="bodyStrong" align="center" testID="cierre-meta-separado">
                {`Separaste ${formatoSoles(separado)} para tu cuota`}
              </Text>
            ) : sugerenciaMeta && sugerenciaMeta.monto > 0 ? (
              <View style={styles.exitoMonto}>
                <MensajeError mensaje={errorSeparar} testID="cierre-meta-error" />
                <Button
                  title={`Separar ${formatoSoles(sugerenciaMeta.monto)} para tu cuota`}
                  variant="outline"
                  leftIcon={PiggyBank}
                  loading={separando}
                  onPress={() => separarParaCuota()}
                  testID="cierre-meta-separar"
                />
              </View>
            ) : null
          ) : null}
        </View>
        <StickyFooter>
          <Button title="Listo" size="lg" fullWidth onPress={cerrar} testID="cierre-listo" />
        </StickyFooter>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Cerrar mi día"
          subtitle={
            original
              ? `Editando el ${formatoFecha(original.fecha).toLowerCase()}`
              : formatoFecha(fechaLocal(new Date()))
          }
          onBack={cerrar}
          style={styles.encabezado}
          backTestID="cerrar-atras"
          subtitleTestID="cerrar-fecha"
        />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
        >
          {editandoHoy ? (
            <Callout accessibilityLiveRegion="polite" testID="cerrar-ya-cerraste">
              <Text variant="bodyStrong">Ya cerraste hoy. Estás editando ese cierre.</Text>
            </Callout>
          ) : null}

          <View style={styles.bloque}>
            <Text variant="h3">¿Cuánto preparaste y cuánto te sobró?</Text>
            {activos.length === 0 ? (
              <Card style={styles.tarjeta}>
                <Text>Agrega un producto activo en Perfil para registrar lo que vendes.</Text>
                <Button title="Ir a mis productos" variant="outline" onPress={() => navigation.navigate('Perfil')} testID="cerrar-agregar-producto" />
              </Card>
            ) : null}
            {activos.map(p => (
              <Card key={p.id} style={styles.tarjeta}>
                <Text variant="bodyStrong">
                  {p.nombre}{' '}
                  <Text variant="label" color="textMuted">
                    a {formatoSoles(precioDe(p.id, p.precioVenta))}
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
              </Card>
            ))}
          </View>

          <AmountInput
            label="¿Cuánto fue por Yape?"
            value={yape}
            onChangeText={setYape}
            error={errores.montoYape}
            testID="monto-yape"
          />
          {sumados ? (
            <Callout accessibilityLiveRegion="polite" testID="cerrar-yapes-nota">
              <Text variant="bodyStrong">
                {`${anotados.length === 1 ? 'Sumamos tu yape anotado' : `Sumamos tus ${anotados.length} yapes anotados`} · ${formatoSoles(sumaAnotados)}`}
              </Text>
              <Text variant="caption">Puedes cambiar el monto si hace falta.</Text>
            </Callout>
          ) : anotados.length > 0 ? (
            <Card variant="bordered" style={styles.tarjeta} testID="cerrar-yapes-pendientes">
              <Text>
                {`Tienes ${anotados.length === 1 ? '1 yape anotado' : `${anotados.length} yapes anotados`} · ${formatoSoles(sumaAnotados)}`}
              </Text>
              <Button
                title="Sumar mis yapes anotados"
                variant="outline"
                onPress={sumarAnotados}
                testID="cerrar-sumar-yapes"
              />
            </Card>
          ) : null}

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
              <View key={g.id} style={styles.gasto} testID={`gasto-${i}`}>
                <Text style={styles.gastoCategoria} testID={`gasto-${i}-categoria`}>
                  {ETIQUETA_GASTO[g.categoria]}
                </Text>
                <Text variant="bodyStrong" color="danger" testID={`gasto-${i}-monto`}>
                  − {formatoSoles(g.monto)}
                </Text>
                <Button
                  title="Quitar"
                  variant="ghost"
                  accessibilityLabel={`Quitar el gasto de ${ETIQUETA_GASTO[g.categoria]}, ${formatoSoles(g.monto)}`}
                  onPress={() => quitarGasto(g.id)}
                  testID={`quitar-gasto-${i}`}
                />
              </View>
            ))}
          </View>

          <Card style={styles.tarjeta}>
            <SwitchRow
              label="Hoy compré mercadería"
              description="Desde este día cuento un ciclo de compra nuevo."
              value={abreCiclo}
              onValueChange={setAbreCiclo}
              testID="hoy-compre-mercaderia"
            />
          </Card>

          <Card style={[styles.tarjeta, styles.teQueda]}>
            <View style={styles.teQuedaTexto} testID="cerrar-resultado-texto">
              <Text variant="label">Resultado registrado</Text>
              <Text variant="caption" color="textMuted">Ventas menos gastos registrados. No equivale al efectivo recibido.</Text>
            </View>
            <Text
              variant="amount"
              color={teQueda < 0 ? 'danger' : 'success'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.teQuedaMonto}
              testID="cerrar-te-queda"
            >
              {formatoSoles(teQueda)}
            </Text>
          </Card>
        </ScrollView>

        <StickyFooter>
          {errores.cierre ? (
            <Text color="danger" accessibilityLiveRegion="polite" testID="error-cierre">
              {errores.cierre}
            </Text>
          ) : null}
          <MensajeError mensaje={mensajeError} testID="error-guardar-dia" />
          <Button
            title={original ? 'Guardar los cambios' : 'Guardar mi día'}
            size="lg"
            fullWidth
            loading={guardando}
            onPress={() => guardar()}
            testID="guardar-dia"
          />
          {original ? (
            <Button
              title="Cancelar"
              variant="ghost"
              fullWidth
              onPress={cerrar}
              testID="cancelar-edicion"
            />
          ) : null}
        </StickyFooter>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  encabezado: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  exito: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  exitoMonto: { alignItems: 'center', alignSelf: 'stretch', gap: spacing.xs },
  bloque: { gap: spacing.md },
  tarjeta: { padding: spacing.md, gap: spacing.sm },
  fila: { flexDirection: 'row', gap: spacing.md },
  columna: { flex: 1 },
  gasto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gastoCategoria: { flex: 1 },
  // El texto cede (flex: 1) y el monto no se parte: a 360 dp con fuente grande no se desborda.
  teQueda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  teQuedaTexto: { flex: 1 },
  teQuedaMonto: { flexShrink: 0, maxWidth: '55%' },
});
