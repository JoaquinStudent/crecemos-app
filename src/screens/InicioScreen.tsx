// src/screens/InicioScreen.tsx
// Responde "¿cómo me fue?" y "¿qué decido hoy?". De arriba hacia abajo: saludo, ciclo de compra,
// el insight, las recomendaciones, el Yape por cobrar, el último día y el botón "Cerrar mi día".
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Lightbulb } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { evaluarReglas } from '@analisis/reglas';
import { calcularCierre } from '@dominio/cierre';
import {
  agruparCiclos,
  porcentajeCapitalRecuperado,
  resumirCiclo,
  textoCapital,
} from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { formatoFecha, formatoSoles } from '@dominio/formato';
import { inicialesAvatar } from '@dominio/perfil';
import { useCrecemos, type EstadoSemilla } from '@context/CrecemosProvider';
import type { Ciclo, Recomendacion } from '@dominio/tipos';
import type { RootStackParamList } from '@navigation/RootStack';
import type { TabsParamList } from '@navigation/Tabs';

type InicioNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** El mismo periodo que mira "Qué me deja cada uno": los últimos 30 días, contando el día 30. */
const DIAS_DEL_INSIGHT = 30;

export const InicioScreen = () => {
  const { cierres, productos, perfil, cargando, semilla, cargarDatosDeEjemplo, marcarCobrado } =
    useCrecemos();
  const navigation = useNavigation<InicioNavigation>();
  const hoy = fechaLocal(new Date());

  // 'YYYY-MM-DD' ordena igual como texto que como fecha.
  const ultimo = cierres.reduce<(typeof cierres)[number] | null>(
    (masReciente, c) => (masReciente === null || c.fecha > masReciente.fecha ? c : masReciente),
    null,
  );
  const ciclos = useMemo(() => agruparCiclos(cierres), [cierres]);
  const cicloActual = ciclos[ciclos.length - 1];
  const porCobrar = useMemo(() => totalPorCobrar(cierres), [cierres]);
  const frase = useMemo(
    () => insight(gananciaPorProducto(cierres, restarDias(hoy, DIAS_DEL_INSIGHT))),
    [cierres, hoy],
  );
  const recomendaciones = useMemo(
    () => evaluarReglas({ cierres, productos, hoy }),
    [cierres, productos, hoy],
  );
  const nombre = perfil.nombre.trim();
  const irACerrarDia = () => navigation.navigate('CerrarDia');

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <View style={styles.saludo}>
            <Text variant="h2" testID="inicio-saludo">
              {nombre ? `Hola, ${nombre}` : 'Hola'}
            </Text>
            <Text variant="bodySmall" color="textMuted" testID="inicio-fecha">
              {formatoFecha(fechaLocal(new Date()))}
            </Text>
          </View>
          {/* El círculo nunca va solo: lleva debajo su etiqueta (UX, regla 1). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            onPress={() => navigation.navigate('Perfil')}
            style={styles.perfil}
            testID="abrir-perfil"
          >
            <View style={styles.avatar}>
              <Text variant="bodyStrong" color="textInverse" testID="inicio-avatar-iniciales">
                {inicialesAvatar(perfil.nombre)}
              </Text>
            </View>
            <Text variant="caption" color="primary">
              Mi perfil
            </Text>
          </Pressable>
        </View>

        {cargando ? null : ultimo && cicloActual ? (
          <>
            <TarjetaCiclo ciclo={cicloActual} />
            {frase ? (
              <TarjetaInsight frase={frase} alVer={() => navigation.navigate('QueMeDeja')} />
            ) : null}
            <Recomendaciones recomendaciones={recomendaciones} ciclos={ciclos.length} />
            {porCobrar.pagos > 0 ? (
              <TarjetaPorCobrar
                pagos={porCobrar.pagos}
                total={porCobrar.total}
                alCobrar={marcarCobrado}
              />
            ) : null}
            <ResumenDelDia fecha={ultimo.fecha} resumen={calcularCierre(ultimo)} />
            {/* La única acción principal de la pantalla (UX, regla 2). */}
            <Button
              title="Cerrar mi día"
              size="lg"
              fullWidth
              testID="inicio-cerrar-dia-rapido"
              onPress={irACerrarDia}
            />
          </>
        ) : (
          <>
            <View style={styles.tarjeta}>
              <Text variant="h3">Aún no cierras ningún día</Text>
              <Text color="textMuted" style={styles.separado}>
                Cuando cierres tu día, aquí vas a ver cuánto te queda: lo que vendiste menos lo que
                gastaste.
              </Text>
              <Button
                title="Cerrar mi día"
                size="lg"
                fullWidth
                style={styles.separado}
                testID="inicio-cerrar-dia"
                onPress={irACerrarDia}
              />
            </View>
            <DatosDeEjemplo estado={semilla} alCargar={cargarDatosDeEjemplo} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const ResumenDelDia = ({
  fecha,
  resumen,
}: {
  fecha: string;
  resumen: ReturnType<typeof calcularCierre>;
}) => (
  <View style={styles.tarjeta}>
    <Text variant="label" color="textMuted">
      Tu último día · {formatoFecha(fecha)}
    </Text>
    <Text variant="bodyStrong" style={styles.separado}>
      Te queda
    </Text>
    <Text
      variant="hero"
      color={resumen.teQueda < 0 ? 'danger' : 'success'}
      testID="inicio-te-queda"
      adjustsFontSizeToFit
      numberOfLines={1}
    >
      {formatoSoles(resumen.teQueda)}
    </Text>
    <View style={[styles.fila, styles.separado]}>
      <View style={styles.columna}>
        <Text variant="label" color="textMuted">
          Vendiste
        </Text>
        <Text variant="h3" color="success">
          + {formatoSoles(resumen.venta)}
        </Text>
      </View>
      <View style={styles.columna}>
        <Text variant="label" color="textMuted">
          Gastaste
        </Text>
        <Text variant="h3" color="danger">
          − {formatoSoles(resumen.gastoTotal)}
        </Text>
      </View>
    </View>
  </View>
);

/** El ciclo de compra actual: cuánto te queda desde que compraste y cuánto falta del capital. */
const TarjetaCiclo = ({ ciclo }: { ciclo: Ciclo }) => {
  const resumen = resumirCiclo(ciclo);
  const recuperado = resumen.capitalRecuperadoEn !== undefined;
  const porcentaje = porcentajeCapitalRecuperado(resumen);
  return (
    <View style={styles.tarjeta}>
      <Text variant="label" color="textMuted" testID="inicio-ciclo-titulo">
        {`Ciclo de compra · día ${ciclo.cierres.length}`}
      </Text>
      {ciclo.cierres[0].abreCiclo ? (
        <Text variant="bodySmall" color="textMuted" testID="inicio-ciclo-compra">
          {`Compraste el ${formatoFecha(ciclo.inicio).toLowerCase()}`}
        </Text>
      ) : null}
      <Text variant="bodyStrong" style={styles.separado}>
        Te queda
      </Text>
      <Text
        variant="display"
        color={resumen.teQueda < 0 ? 'danger' : 'success'}
        testID="inicio-ciclo-te-queda"
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatoSoles(resumen.teQueda)}
      </Text>
      <View style={[styles.fila, styles.separado]}>
        <View style={styles.columna}>
          <Text variant="label" color="textMuted">
            Vendiste
          </Text>
          <Text variant="h3" color="success" testID="inicio-ciclo-vendiste">
            {`+ ${formatoSoles(resumen.venta)}`}
          </Text>
        </View>
        <View style={styles.columna}>
          <Text variant="label" color="textMuted">
            Gastaste
          </Text>
          <Text variant="h3" color="danger" testID="inicio-ciclo-gastaste">
            {`− ${formatoSoles(resumen.capital)}`}
          </Text>
        </View>
      </View>
      {resumen.capital > 0 ? (
        <View style={styles.separado}>
          {/* El naranja es solo relleno; el texto va siempre en letra oscura (UX, regla 5). */}
          <View
            style={styles.barra}
            accessibilityRole="progressbar"
            accessibilityLabel="Capital recuperado"
            accessibilityValue={{ min: 0, max: 100, now: porcentaje }}
            testID="inicio-ciclo-barra"
          >
            <View
              style={[
                styles.barraRelleno,
                {
                  width: `${porcentaje}%`,
                  backgroundColor: recuperado ? colors.success : colors.accent,
                },
              ]}
              testID="inicio-ciclo-barra-relleno"
            />
          </View>
          <Text variant="caption" style={styles.textoBarra} testID="inicio-ciclo-capital">
            {textoCapital(resumen)}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

/**
 * La frase que contrasta lo que se vende con lo que deja. El naranja es solo fondo, borde e ícono
 * (UX, regla 5): el texto va en letra oscura y el enlace, en el color de marca.
 */
const TarjetaInsight = ({ frase, alVer }: { frase: string; alVer: () => void }) => (
  <View style={styles.insight} testID="inicio-insight">
    <View style={styles.insightFrase}>
      <Icon icon={Lightbulb} color="accent" size="lg" />
      <Text variant="bodyStrong" style={styles.insightTexto} testID="inicio-insight-texto">
        {frase}
      </Text>
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver qué me deja cada uno"
      onPress={alVer}
      style={styles.enlace}
      testID="inicio-ver-que-me-deja"
    >
      <Text variant="bodyStrong" color="primary" testID="inicio-ver-que-me-deja-texto">
        Ver qué me deja cada uno
      </Text>
      <Icon icon={ArrowRight} color="primary" size="md" />
    </Pressable>
  </View>
);

/**
 * Hasta 2 decisiones para hoy, por prioridad. Con cierres pero menos de 2 ciclos, el motor no
 * inventa: lo dice. Con 2 ciclos o más y ninguna recomendación, no muestra nada.
 */
const Recomendaciones = ({
  recomendaciones,
  ciclos,
}: {
  recomendaciones: Recomendacion[];
  ciclos: number;
}) => {
  if (recomendaciones.length === 0) {
    return ciclos < 2 ? (
      <View style={styles.tarjeta}>
        <Text color="textMuted" testID="inicio-sin-recomendaciones">
          Cierra 2 ciclos para ver recomendaciones
        </Text>
      </View>
    ) : null;
  }
  return (
    <View style={styles.recomendaciones} testID="inicio-recomendaciones">
      <Text variant="h3" accessibilityRole="header">
        Para decidir hoy
      </Text>
      {recomendaciones.map(r => (
        <View
          key={r.reglaId}
          style={styles.tarjetaBorde}
          testID={`inicio-recomendacion-${r.reglaId}`}
        >
          <Text testID={`inicio-recomendacion-${r.reglaId}-texto`}>{r.mensaje}</Text>
        </View>
      ))}
    </View>
  );
};

/** El Yape que entró a una cuenta ajena y todavía no recibe. Confirma diciendo cuánto, en la misma tarjeta. */
const TarjetaPorCobrar = ({
  pagos,
  total,
  alCobrar,
}: {
  pagos: number;
  total: number;
  alCobrar: () => Promise<void>;
}) => {
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const yaLosRecibi = async () => {
    setGuardando(true);
    try {
      await alCobrar();
    } finally {
      setGuardando(false);
      setConfirmando(false);
    }
  };

  return (
    <View style={styles.tarjetaBorde}>
      <View style={styles.filaSpace}>
        <View style={styles.columna}>
          <Text variant="label">Yape por cobrar</Text>
          <Text variant="caption" color="textMuted" testID="inicio-por-cobrar-pagos">
            {pagos === 1 ? '1 pago' : `${pagos} pagos`}
          </Text>
        </View>
        <Text variant="h3" testID="inicio-por-cobrar-total">
          {formatoSoles(total)}
        </Text>
      </View>
      {confirmando ? (
        <View style={styles.separado}>
          <Text variant="bodyStrong" testID="inicio-cobrado-pregunta">
            {`¿Ya recibiste ${formatoSoles(total)} en tu Yape?`}
          </Text>
          <Button
            title="Sí, ya los recibí"
            variant="outline"
            fullWidth
            disabled={guardando}
            style={styles.separado}
            testID="inicio-cobrado-si"
            onPress={yaLosRecibi}
          />
          <Button
            title="No, todavía"
            variant="ghost"
            fullWidth
            disabled={guardando}
            style={styles.separadoChico}
            testID="inicio-cobrado-no"
            onPress={() => setConfirmando(false)}
          />
        </View>
      ) : (
        <Button
          title="Marcar como cobrado"
          variant="outline"
          fullWidth
          style={styles.separado}
          testID="inicio-marcar-cobrado"
          onPress={() => setConfirmando(true)}
        />
      )}
    </View>
  );
};

/**
 * Sin días cerrados, qué decir de los datos de ejemplo. Nunca un código ni una excepción:
 * sin señal la app funciona igual. Quien ya resolvió la semilla (la cargó o ya tiene su
 * propia historia) no vuelve a ver nada de esto.
 */
const DatosDeEjemplo = ({
  estado,
  alCargar,
}: {
  estado: EstadoSemilla;
  alCargar: () => Promise<void>;
}) => {
  if (estado === 'ninguna' || estado === 'lista') return null;
  const mensaje =
    estado === 'cargando'
      ? 'Cargando datos de ejemplo…'
      : estado === 'invalida'
      ? 'No pudimos cargar los datos de ejemplo'
      : 'Sin señal no pasa nada: la app funciona igual.';
  return (
    <View style={styles.tarjeta}>
      <Text color="textMuted" testID="inicio-semilla-mensaje">
        {mensaje}
      </Text>
      {estado === 'cargando' ? null : (
        <Button
          title="Cargar datos de ejemplo"
          variant="outline"
          fullWidth
          style={styles.separado}
          testID="inicio-cargar-ejemplo"
          onPress={() => {
            alCargar().catch(() => undefined);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saludo: { flex: 1, paddingRight: spacing.md },
  perfil: { minWidth: 48, minHeight: 48, alignItems: 'center', gap: spacing.xxs },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  tarjetaBorde: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  insight: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  insightFrase: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  insightTexto: { flex: 1 },
  enlace: {
    alignSelf: 'flex-start',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  recomendaciones: { gap: spacing.md },
  separado: { marginTop: spacing.md },
  separadoChico: { marginTop: spacing.sm },
  filaSpace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barra: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barraRelleno: { height: 10, borderRadius: radius.full },
  textoBarra: { marginTop: spacing.sm },
  fila: { flexDirection: 'row', gap: spacing.lg },
  columna: { flex: 1 },
});
