// src/screens/PerfilScreen.tsx
// "Mi perfil" (mock 07, sin foto): quién es, cómo le pagan y qué vende.
// Es la pantalla que hace posible el insight: sin precio y costo no hay "Te deja".
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Clock, TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Input } from '@components/atoms/Input';
import { CambiarPrecioSheet } from '@components/organisms/CambiarPrecioSheet';
import { fechaLocal } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import { inicialesAvatar } from '@dominio/perfil';
import { requiereRevision, teDeja } from '@dominio/producto';
import type { Perfil, Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';
import { fechaCorta } from './fechaEnPalabras';

type CampoDato = 'nombre' | 'negocio' | 'ubicacion';

const DATOS: readonly { campo: CampoDato; etiqueta: string; ayuda: string }[] = [
  { campo: 'nombre', etiqueta: 'Mi nombre', ayuda: 'Escribe tu nombre' },
  { campo: 'negocio', etiqueta: 'Mi negocio', ayuda: 'Escribe el nombre de tu negocio' },
  { campo: 'ubicacion', etiqueta: 'Dónde vendo', ayuda: 'Escribe dónde vendes' },
];

export const PerfilScreen = () => {
  const { perfil, productos, guardarPerfil } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Perfil'>>();
  const [editando, setEditando] = useState<CampoDato | null>(null);
  const [borrador, setBorrador] = useState('');
  const [enHoja, setEnHoja] = useState<Producto | null>(null);
  const [hojaVisible, setHojaVisible] = useState(false);

  const hoy = fechaLocal(new Date());

  const editar = (campo: CampoDato) => {
    setBorrador(perfil[campo] ?? '');
    setEditando(campo);
  };

  const guardarDato = async (campo: CampoDato) => {
    await guardarPerfil({ [campo]: borrador.trim() } as Partial<Perfil>);
    setEditando(null);
  };

  const abrirHoja = (producto: Producto) => {
    setEnHoja(producto);
    setHojaVisible(true);
  };

  return (
    <View style={styles.pantalla}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <SafeAreaView edges={['top']} style={styles.encabezado}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            onPress={() => navigation.goBack()}
            style={styles.atras}
            testID="perfil-atras"
          >
            <Icon icon={ChevronLeft} color="textInverse" size="lg" />
            <Text variant="bodyStrong" color="textInverse">
              Atrás
            </Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text variant="display" color="textInverse" testID="perfil-iniciales">
              {inicialesAvatar(perfil.nombre)}
            </Text>
          </View>
          <Text variant="h2" color="textInverse" align="center" testID="perfil-nombre">
            {perfil.nombre || 'Agrega tu nombre'}
          </Text>
          {perfil.negocio ? (
            <Text color="textInverse" align="center">
              {perfil.negocio}
            </Text>
          ) : null}
        </SafeAreaView>

        <View style={styles.contenido}>
          <View style={styles.seccion}>
            <Text variant="h3">Mis datos</Text>
            <View style={styles.tarjeta}>
              {DATOS.map(({ campo, etiqueta, ayuda }, i) => (
                <View key={campo} style={[styles.filaDato, i > 0 && styles.separador]}>
                  {editando === campo ? (
                    <View style={styles.edicion}>
                      <Input
                        label={etiqueta}
                        value={borrador}
                        onChangeText={setBorrador}
                        autoFocus
                        autoCapitalize="words"
                        testID={`input-${campo}`}
                      />
                      <View style={styles.acciones}>
                        <Button
                          title="Guardar"
                          variant="outline"
                          onPress={() => guardarDato(campo)}
                          testID={`guardar-${campo}`}
                        />
                        <Button
                          title="Cancelar"
                          variant="ghost"
                          onPress={() => setEditando(null)}
                          testID={`cancelar-${campo}`}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.dato}>
                      <View style={styles.datoTexto}>
                        <Text variant="label" color="textMuted">
                          {etiqueta}
                        </Text>
                        {perfil[campo] ? (
                          <Text testID={`valor-${campo}`}>{perfil[campo]}</Text>
                        ) : (
                          <Text color="textMuted">{ayuda}</Text>
                        )}
                      </View>
                      <Button
                        title="Editar"
                        variant="ghost"
                        onPress={() => editar(campo)}
                        accessibilityLabel={`Editar ${etiqueta.toLowerCase()}`}
                        testID={`editar-${campo}`}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.seccion}>
            <Text variant="h3">Cómo me pagan</Text>
            <View style={styles.tarjeta}>
              <View style={styles.filaInterruptor}>
                <Text style={styles.etiquetaInterruptor}>Acepto Yape</Text>
                <Switch
                  value={perfil.aceptaYape}
                  onValueChange={v => guardarPerfil({ aceptaYape: v })}
                  trackColor={{ false: colors.disabled, true: colors.primary }}
                  thumbColor={colors.background}
                  accessibilityLabel="Acepto Yape"
                  testID="switch-acepta-yape"
                />
              </View>
              <View style={[styles.separador, styles.indentada]}>
                <View style={styles.filaInterruptor}>
                  <Text
                    style={styles.etiquetaInterruptor}
                    color={perfil.aceptaYape ? 'text' : 'disabled'}
                  >
                    El Yape no está a mi nombre
                  </Text>
                  <Switch
                    value={perfil.yapeAjeno}
                    disabled={!perfil.aceptaYape}
                    onValueChange={v => guardarPerfil({ yapeAjeno: v })}
                    trackColor={{ false: colors.disabled, true: colors.primary }}
                    thumbColor={colors.background}
                    accessibilityLabel="El Yape no está a mi nombre"
                    testID="switch-yape-ajeno"
                  />
                </View>
                <Text variant="caption" color="textMuted" style={styles.ayudaInterruptor}>
                  Lo anotamos como pendiente por cobrar hasta que lo recibas.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.seccion}>
            <View>
              <Text variant="h3">Mis productos</Text>
              <Text variant="caption" color="textMuted">
                Con esto calculamos cuánto te deja cada uno.
              </Text>
            </View>
            {productos
              .filter(p => p.activo)
              .map(p => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  hoy={hoy}
                  onCambiarPrecio={() => abrirHoja(p)}
                />
              ))}
          </View>
        </View>
      </ScrollView>

      <CambiarPrecioSheet
        producto={enHoja}
        visible={hojaVisible}
        onClose={() => setHojaVisible(false)}
      />
    </View>
  );
};

const TarjetaProducto = ({
  producto,
  hoy,
  onCambiarPrecio,
}: {
  producto: Producto;
  hoy: string;
  onCambiarPrecio: () => void;
}) => {
  const deja = teDeja(producto);
  const revision = requiereRevision(producto, hoy);
  return (
    <View style={styles.tarjetaProducto} testID={`producto-${producto.id}`}>
      <View style={styles.filaProducto}>
        <Text variant="bodyStrong">{producto.nombre}</Text>
        <Text variant="h3">{formatoSoles(producto.precioVenta)}</Text>
      </View>
      <Text variant="bodySmall" color="textMuted">
        Te cuesta {formatoSoles(producto.costoUnitario)} ·{' '}
        <Text variant="bodySmall" color={deja.monto < 0 ? 'danger' : 'success'}>
          Te deja {formatoSoles(deja.monto)}
        </Text>{' '}
        · {deja.porcentaje}%
      </Text>
      <View style={styles.filaProducto}>
        <View style={styles.actualizado}>
          <Icon icon={Clock} size="sm" color="textMuted" />
          <Text variant="caption" color="textMuted" style={styles.actualizadoTexto}>
            Precio actualizado el {fechaCorta(producto.actualizadoEn)}
          </Text>
        </View>
        <Button
          title="Cambiar precio"
          variant="ghost"
          onPress={onCambiarPrecio}
          accessibilityLabel={`Cambiar precio de ${producto.nombre}`}
          testID={`cambiar-precio-${producto.id}`}
        />
      </View>
      {revision.revisar ? (
        <View style={styles.aviso} testID={`aviso-precio-${producto.id}`}>
          <Icon icon={TriangleAlert} color="accent" />
          <Text variant="bodySmall" style={styles.avisoTexto}>
            {revision.mensaje}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  encabezado: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  atras: {
    alignSelf: 'flex-start',
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primaryPressed,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  seccion: { gap: spacing.md },
  tarjeta: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  separador: { borderTopWidth: 1, borderTopColor: colors.border },
  filaDato: { paddingVertical: spacing.sm },
  dato: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  datoTexto: { flex: 1 },
  edicion: { gap: spacing.sm },
  acciones: { flexDirection: 'row', gap: spacing.sm },
  filaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: spacing.md,
  },
  etiquetaInterruptor: { flex: 1 },
  indentada: { paddingLeft: spacing.lg },
  ayudaInterruptor: { paddingBottom: spacing.md },
  tarjetaProducto: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  filaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actualizado: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actualizadoTexto: { flex: 1 },
  aviso: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoTexto: { flex: 1 },
});
