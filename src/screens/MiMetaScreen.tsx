// src/screens/MiMetaScreen.tsx
// "Mi cuota": la alcancía para juntar la cuota del préstamo. Sin meta, un estado vacío que
// enseña; con meta, el anillo de avance, cuánto separar hoy (UN botón principal, un toque),
// lo ya separado con su "Quitar", y editar o borrar la meta. Todo con texto, nada solo con ícono.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PiggyBank } from 'lucide-react-native';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { MensajeError } from '@components/atoms/MensajeError';
import { AmountInput } from '@components/molecules/AmountInput';
import { AnilloProgreso } from '@components/molecules/AnilloProgreso';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { CargandoBloques } from '@components/molecules/CargandoBloques';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { EmptyState } from '@components/molecules/EmptyState';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { ScrollConTeclado } from '@components/molecules/ScrollConTeclado';
import { fechaDesdePartes, fechaLocal } from '@dominio/fecha';
import { formatoFecha, formatoFechaCorta, formatoSoles, parseAmount } from '@dominio/formato';
import {
  aportadoEn,
  estado as estadoDeMeta,
  Meta,
  plazosRapidos,
  progreso,
  sugerenciaDeHoy,
  teQuedaDelUltimoCierre,
  textoPlazo,
  totalAportado,
  validarMeta,
} from '@dominio/meta';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

type Navegacion = NativeStackNavigationProp<RootStackParamList, 'MiMeta'>;

export const MiMetaScreen = () => {
  const { meta, cierres, cargando } = useCrecemos();
  const navigation = useNavigation<Navegacion>();
  const [formulario, setFormulario] = useState(false);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollConTeclado
        contentContainerStyle={styles.contenido}
        testID="meta-scroll"
      >
        <ScreenHeader
          title="Mi cuota"
          subtitle="Junta de a poquito para llegar tranquilo al día de pago"
          onBack={() => navigation.goBack()}
          backTestID="meta-atras"
        />
        {cargando ? (
          <CargandoBloques bloques={2} alto={140} testID="meta-cargando" />
        ) : formulario ? (
          <FormularioMeta meta={meta} alTerminar={() => setFormulario(false)} />
        ) : meta ? (
          <VistaMeta meta={meta} cierres={cierres} alEditar={() => setFormulario(true)} />
        ) : (
          <EmptyState
            title="Aún no tienes una meta"
            text="Pon cuánto es tu cuota y el día en que la pagas. Te digo cuánto separar cada día."
            actionLabel="Crear mi meta"
            onAction={() => setFormulario(true)}
            testID="meta-vacia"
            actionTestID="meta-crear"
          />
        )}
      </ScrollConTeclado>
    </SafeAreaView>
  );
};

/** La meta ya creada: anillo, lo de hoy, lo separado y las acciones para editarla o borrarla. */
const VistaMeta = ({
  meta,
  cierres,
  alEditar,
}: {
  meta: Meta;
  cierres: ReturnType<typeof useCrecemos>['cierres'];
  alEditar: () => void;
}) => {
  const { aportarAMeta, quitarAporte, borrarMeta } = useCrecemos();
  const hoy = fechaLocal(new Date());
  const [otroAbierto, setOtroAbierto] = useState(false);
  const [otroMonto, setOtroMonto] = useState('');
  const [errorOtro, setErrorOtro] = useState<string | undefined>();
  const [confirmando, setConfirmando] = useState(false);

  const teQueda = teQuedaDelUltimoCierre(cierres);
  const sugerencia = useMemo(() => sugerenciaDeHoy(meta, hoy, teQueda), [meta, hoy, teQueda]);
  const separado = totalAportado(meta);
  const estadoActual = estadoDeMeta(meta, hoy);
  const yaHoy = aportadoEn(meta, hoy);
  const aportes = [...meta.aportes].reverse();

  const { ejecutar: separarSugerido, ejecutando: separando, mensajeError: errorSeparar } =
    useAccionSegura(async () => {
      await aportarAMeta(sugerencia.monto);
    });
  const { ejecutar: separarOtro, ejecutando: separandoOtro, mensajeError: errorGuardarOtro } =
    useAccionSegura(async () => {
      const resultado = await aportarAMeta(parseAmount(otroMonto));
      if (!resultado.ok) {
        setErrorOtro(resultado.errores.monto ?? resultado.errores.meta);
        return;
      }
      setErrorOtro(undefined);
      setOtroMonto('');
      setOtroAbierto(false);
    });
  const { ejecutar: quitar, mensajeError: errorQuitar } = useAccionSegura(
    async (id: string) => quitarAporte(id),
    'No pudimos quitarlo. Inténtalo otra vez.',
  );
  const { ejecutar: borrar, ejecutando: borrando, mensajeError: errorBorrar } = useAccionSegura(
    async () => {
      await borrarMeta();
    },
    'No pudimos borrar tu meta. Inténtalo otra vez.',
  );

  const mensajeHoy = (() => {
    if (estadoActual === 'cumplida') return 'Ya juntaste lo de tu cuota. ¡Bien hecho!';
    if (sugerencia.monto > 0) return `Hoy separa ${formatoSoles(sugerencia.monto)} y llegas a tiempo`;
    if (sugerencia.limitadoPorTeQueda) {
      return 'Hoy no te propongo separar: en tu último día te quedó muy poco.';
    }
    return yaHoy > 0 ? 'Hoy ya separaste lo que tocaba. ¡Bien!' : 'Hoy no te toca separar.';
  })();

  return (
    <>
      <Card variant="bordered" style={styles.centrado} testID="meta-tarjeta">
        <AnilloProgreso
          value={progreso(meta)}
          accessibilityLabel="Avance de tu meta"
          accessibilityValueText={`${formatoSoles(separado)} de ${formatoSoles(meta.montoObjetivo)}`}
          tone={estadoActual === 'cumplida' ? 'success' : 'primary'}
          testID="meta-anillo"
        >
          <Text variant="label" color="textMuted">
            Llevas
          </Text>
          <Text variant="amount" numberOfLines={1} adjustsFontSizeToFit testID="meta-separado">
            {formatoSoles(separado)}
          </Text>
        </AnilloProgreso>
        <Text variant="bodyStrong" align="center" testID="meta-avance">
          {`${formatoSoles(separado)} de ${formatoSoles(meta.montoObjetivo)}`}
        </Text>
        <Text align="center" testID="meta-plazo">
          {`${textoPlazo(meta, hoy)} · ${formatoFecha(meta.fechaLimite)}`}
        </Text>
        <Text variant="label" color="textMuted" align="center" testID="meta-estado">
          {estadoActual === 'cumplida'
            ? 'Cumpliste tu meta'
            : estadoActual === 'al día'
            ? 'Vas al día'
            : 'Vas un poco atrasado'}
        </Text>
      </Card>

      <Card
        variant="bordered"
        style={styles.centrado}
        wrapperStyle={styles.bloque}
        testID="meta-hoy"
      >
        <Text variant="bodyStrong" testID="meta-hoy-mensaje">
          {mensajeHoy}
        </Text>
        {sugerencia.limitadoPorTeQueda && teQueda !== undefined && estadoActual !== 'cumplida' ? (
          <Callout testID="meta-tope">
            <Text variant="bodySmall">
              {`En tu último día te quedaron ${formatoSoles(teQueda)}. No te propongo separar más de lo que tienes.`}
            </Text>
          </Callout>
        ) : null}
        <MensajeError mensaje={errorSeparar} testID="meta-error-separar" />
        {sugerencia.monto > 0 ? (
          <Button
            title={`Separar ${formatoSoles(sugerencia.monto)}`}
            size="lg"
            fullWidth
            loading={separando}
            leftIcon={PiggyBank}
            onPress={() => separarSugerido()}
            testID="meta-separar"
          />
        ) : null}
        {estadoActual !== 'cumplida' ? (
          otroAbierto ? (
            <View style={styles.bloque}>
              <AmountInput
                label="¿Cuánto vas a separar?"
                value={otroMonto}
                onChangeText={texto => {
                  setOtroMonto(texto);
                  setErrorOtro(undefined);
                }}
                error={errorOtro}
                testID="meta-otro-monto"
              />
              <MensajeError mensaje={errorGuardarOtro} testID="meta-error-otro" />
              <Button
                title="Separar este monto"
                variant="outline"
                fullWidth
                loading={separandoOtro}
                disabled={parseAmount(otroMonto) <= 0}
                onPress={() => separarOtro()}
                testID="meta-otro-guardar"
              />
              <Button
                title="Cancelar"
                variant="ghost"
                fullWidth
                onPress={() => {
                  setOtroAbierto(false);
                  setOtroMonto('');
                  setErrorOtro(undefined);
                }}
                testID="meta-otro-cancelar"
              />
            </View>
          ) : (
            <Button
              title="Separar otro monto"
              variant="outline"
              fullWidth
              onPress={() => setOtroAbierto(true)}
              testID="meta-otro"
            />
          )
        ) : null}
      </Card>

      <View style={styles.bloque}>
        <Text variant="h3" accessibilityRole="header">
          Lo que has separado
        </Text>
        <MensajeError mensaje={errorQuitar} testID="meta-error-quitar" />
        {aportes.length === 0 ? (
          <Text color="textMuted" testID="meta-sin-aportes">
            Todavía no separaste nada. Empieza hoy con lo que puedas.
          </Text>
        ) : (
          aportes.map((a, i) => (
            <View key={a.id} style={styles.aporte} testID={`meta-aporte-${i}`}>
              <View style={styles.aporteTexto}>
                <Text variant="bodyStrong" testID={`meta-aporte-${i}-monto`}>
                  {formatoSoles(a.monto)}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatoFechaCorta(a.fecha)}
                </Text>
              </View>
              <Button
                title="Quitar"
                variant="ghost"
                accessibilityLabel={`Quitar los ${formatoSoles(a.monto)} separados el ${formatoFechaCorta(a.fecha)}`}
                onPress={() => quitar(a.id)}
                testID={`meta-quitar-${i}`}
              />
            </View>
          ))
        )}
      </View>

      <View style={styles.bloque}>
        <Button
          title="Cambiar monto o fecha"
          variant="ghost"
          fullWidth
          onPress={alEditar}
          testID="meta-editar"
        />
        {confirmando ? (
          <Card variant="bordered">
            <Text variant="bodyStrong" testID="meta-borrar-pregunta">
              ¿Borrar tu meta y todo lo que separaste en ella?
            </Text>
            <MensajeError mensaje={errorBorrar} testID="meta-error-borrar" />
            <Button
              title="Sí, borrar mi meta"
              variant="danger"
              fullWidth
              loading={borrando}
              onPress={() => borrar()}
              testID="meta-borrar-si"
            />
            <Button
              title="No, dejarla"
              variant="ghost"
              fullWidth
              disabled={borrando}
              onPress={() => setConfirmando(false)}
              testID="meta-borrar-no"
            />
          </Card>
        ) : (
          <Button
            title="Borrar mi meta"
            variant="dangerGhost"
            fullWidth
            onPress={() => setConfirmando(true)}
            testID="meta-borrar"
          />
        )}
      </View>
    </>
  );
};

type Plazo = '7' | '15' | 'finDeMes' | 'otra';

const soloDigitos = (texto: string) => texto.replace(/\D/g, '');

/** Crear o cambiar la meta: monto de la cuota y fecha (opciones rápidas o día, mes y año). */
const FormularioMeta = ({ meta, alTerminar }: { meta: Meta | null; alTerminar: () => void }) => {
  const { crearMeta } = useCrecemos();
  const hoy = fechaLocal(new Date());
  const rapidos = useMemo(() => plazosRapidos(hoy), [hoy]);
  const opciones: readonly ChipOption<Plazo>[] = [
    ...rapidos.map(p => ({ value: p.value as Plazo, label: p.label })),
    { value: 'otra', label: 'Otra fecha' },
  ];

  const [monto, setMonto] = useState(meta ? String(meta.montoObjetivo) : '');
  const [plazo, setPlazo] = useState<Plazo | ''>(meta ? 'otra' : '');
  const [anio, mes, dia] = (meta?.fechaLimite ?? '').split('-');
  const [diaTexto, setDiaTexto] = useState(meta ? String(Number(dia)) : '');
  const [mesTexto, setMesTexto] = useState(meta ? String(Number(mes)) : '');
  const [anioTexto, setAnioTexto] = useState(meta ? anio : '');
  const [errores, setErrores] = useState<Record<string, string>>({});

  // La fecha que se va a guardar, o null si todavía no está completa o no existe.
  const fecha =
    plazo === 'otra'
      ? fechaDesdePartes(Number(diaTexto), Number(mesTexto), Number(anioTexto))
      : plazo === ''
      ? null
      : rapidos.find(p => p.value === plazo)?.fecha ?? null;

  const { ejecutar: guardar, ejecutando: guardando, mensajeError } = useAccionSegura(async () => {
    // Se dicen juntos los dos problemas (monto y fecha), no de a uno por intento.
    const montoObjetivo = parseAmount(monto);
    const revision = validarMeta({ montoObjetivo, fechaLimite: fecha ?? hoy }, hoy);
    const encontrados: Record<string, string> = revision.ok ? {} : { ...revision.errores };
    if (fecha === null) {
      encontrados.fechaLimite =
        plazo === 'otra' ? 'Revisa el día, el mes y el año' : 'Elige cuándo pagas tu cuota';
    }
    if (fecha === null || !revision.ok) {
      setErrores(encontrados);
      return;
    }
    const resultado = await crearMeta({ montoObjetivo, fechaLimite: fecha });
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    alTerminar();
  });

  return (
    <View style={styles.bloque} testID="meta-formulario">
      <Text variant="h3" accessibilityRole="header">
        {meta ? 'Cambiar mi meta' : 'Crear mi meta'}
      </Text>
      <AmountInput
        label="¿De cuánto es tu cuota?"
        value={monto}
        onChangeText={texto => {
          setMonto(texto);
          setErrores(previos => ({ ...previos, montoObjetivo: '' }));
        }}
        error={errores.montoObjetivo || undefined}
        testID="meta-monto"
      />
      <ChipGroup
        label="¿Cuándo la pagas?"
        options={opciones}
        value={plazo}
        onChange={valor => {
          setPlazo(valor);
          setErrores(previos => ({ ...previos, fechaLimite: '' }));
        }}
        testIDPrefix="meta-plazo"
        error={plazo === 'otra' ? undefined : errores.fechaLimite || undefined}
      />
      {plazo === 'otra' ? (
        <View style={styles.fechaFila}>
          <Input
            label="Día"
            value={diaTexto}
            onChangeText={t => setDiaTexto(soloDigitos(t).slice(0, 2))}
            keyboardType="number-pad"
            placeholder="15"
            containerStyle={styles.fechaCorta}
            testID="meta-dia"
          />
          <Input
            label="Mes"
            value={mesTexto}
            onChangeText={t => setMesTexto(soloDigitos(t).slice(0, 2))}
            keyboardType="number-pad"
            placeholder="11"
            containerStyle={styles.fechaCorta}
            testID="meta-mes"
          />
          <Input
            label="Año"
            value={anioTexto}
            onChangeText={t => setAnioTexto(soloDigitos(t).slice(0, 4))}
            keyboardType="number-pad"
            placeholder="2026"
            containerStyle={styles.fechaLarga}
            testID="meta-anio"
          />
        </View>
      ) : null}
      {plazo === 'otra' && errores.fechaLimite ? (
        <Text color="danger" accessibilityLiveRegion="polite" testID="meta-error-fecha">
          {errores.fechaLimite}
        </Text>
      ) : null}
      {fecha ? (
        <Text color="textMuted" testID="meta-fecha-elegida">
          {`Pagas el ${formatoFecha(fecha).toLowerCase()}`}
        </Text>
      ) : null}
      <MensajeError mensaje={mensajeError} testID="meta-error-guardar" />
      <Button
        title="Guardar mi meta"
        size="lg"
        fullWidth
        loading={guardando}
        onPress={() => guardar()}
        testID="meta-guardar"
      />
      <Button
        title="Cancelar"
        variant="ghost"
        fullWidth
        onPress={alTerminar}
        testID="meta-cancelar"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  centrado: { alignItems: 'stretch', gap: spacing.md },
  bloque: { gap: spacing.md },
  aporte: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  aporteTexto: { flex: 1 },
  fechaFila: { flexDirection: 'row', gap: spacing.md },
  fechaCorta: { flex: 1 },
  fechaLarga: { flex: 1.4 },
});
