// src/screens/PerfilScreen.tsx
// "Mi perfil" (mock 07, sin foto): quién es, cómo le pagan y qué vende.
// Es la pantalla que hace posible el insight: sin precio y costo no hay "Te deja".
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Clock, TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Input } from '@components/atoms/Input';
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { CambiarPrecioSheet } from '@components/organisms/CambiarPrecioSheet';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import { avatarDe } from '@dominio/foto';
import { validarNumeroYape } from '@dominio/validacion';
import { requiereRevision, teDeja } from '@dominio/producto';
import type { DatosProducto } from '@dominio/validacion';
import type { Perfil, Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { elegirFoto, mensajeFoto } from '@services/foto';
import type { RootStackParamList } from '@navigation/RootStack';

type CampoDato =
  | 'nombre'
  | 'negocio'
  | 'ubicacion'
  | 'yapeNumero'
  | 'yapeTitular'
  | 'yapeParentesco';

interface DatoEditable {
  campo: CampoDato;
  etiqueta: string;
  ayuda: string;
}

const DATOS: readonly DatoEditable[] = [
  { campo: 'nombre', etiqueta: 'Mi nombre', ayuda: 'Escribe tu nombre' },
  { campo: 'negocio', etiqueta: 'Mi negocio', ayuda: 'Escribe el nombre de tu negocio' },
  { campo: 'ubicacion', etiqueta: 'Dónde vendo', ayuda: 'Escribe dónde vendes' },
];

const YAPE_NUMERO: DatoEditable = {
  campo: 'yapeNumero',
  etiqueta: 'Número de Yape',
  ayuda: 'Escribe el número donde recibes Yape',
};
const YAPE_TITULAR: DatoEditable = {
  campo: 'yapeTitular',
  etiqueta: '¿De quién es el Yape?',
  ayuda: 'Escribe el nombre de quien lo tiene',
};
const YAPE_PARENTESCO: DatoEditable = {
  campo: 'yapeParentesco',
  etiqueta: '¿Quién es para ti?',
  ayuda: 'Por ejemplo: hermana, esposa, amigo',
};

export const PerfilScreen = () => {
  const { perfil, productos, guardarPerfil, guardarFoto, quitarFoto, crearProducto, editarProducto, establecerProductoActivo, cargarDatosDeEjemplo, semilla } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Perfil'>>();
  const [editando, setEditando] = useState<CampoDato | null>(null);
  const [borrador, setBorrador] = useState('');
  const [errorBorrador, setErrorBorrador] = useState<string | undefined>();
  const [enHoja, setEnHoja] = useState<Producto | null>(null);
  const [hojaVisible, setHojaVisible] = useState(false);
  const [productoEditado, setProductoEditado] = useState<Producto | null>(null);
  const [formularioProducto, setFormularioProducto] = useState<DatosProducto | null>(null);
  const [precioTexto, setPrecioTexto] = useState('');
  const [costoTexto, setCostoTexto] = useState('');
  const [erroresProducto, setErroresProducto] = useState<Record<string, string>>({});

  const hoy = fechaLocal(new Date());

  // Foto de perfil: se guarda al elegirla. Los botones dependen de si ya hay una foto válida.
  const hayFoto = avatarDe(perfil).tipo === 'foto';
  const [abriendoFoto, setAbriendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [cambiandoFoto, setCambiandoFoto] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  // Un solo selector abierto a la vez, aunque el botón se toque dos veces antes de repintar.
  const selectorAbierto = useRef(false);

  const elegirLaFoto = async (origen: 'galeria' | 'camara') => {
    if (selectorAbierto.current) return;
    selectorAbierto.current = true;
    setAbriendoFoto(true);
    setErrorFoto(null);
    try {
      const resultado = await elegirFoto(origen);
      if (resultado.ok) {
        const guardada = await guardarFoto(resultado.fotoUri);
        if (guardada.ok) setCambiandoFoto(false);
        else setErrorFoto(guardada.errores.foto ?? mensajeFoto('INVALIDA'));
      } else if (resultado.motivo !== 'CANCELADA') {
        // Cancelar no es un error: no se dice nada.
        setErrorFoto(resultado.mensaje ?? mensajeFoto(resultado.motivo));
      }
    } catch {
      setErrorFoto(mensajeFoto('NO_SE_PUDO'));
    } finally {
      selectorAbierto.current = false;
      setAbriendoFoto(false);
    }
  };

  const pedirCambiarFoto = () => {
    setErrorFoto(null);
    setConfirmandoQuitar(false);
    setCambiandoFoto(true);
  };

  const pedirQuitarFoto = () => {
    setErrorFoto(null);
    setCambiandoFoto(false);
    setConfirmandoQuitar(true);
  };

  const confirmarQuitarFoto = async () => {
    await quitarFoto();
    setConfirmandoQuitar(false);
  };

  // El teclado de iOS tapaba la fila que se edita, con su "Guardar" y "Cancelar", y
  // `automaticallyAdjustKeyboardInsets` solo no alcanzaba: al abrir la edición se lleva la
  // fila al borde de arriba de la pantalla, así el campo y sus botones quedan sobre el teclado.
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const filas = useRef<Partial<Record<CampoDato, React.ComponentRef<typeof View> | null>>>({});
  const verFila = (campo: CampoDato) => {
    const fila = filas.current[campo];
    const interior = scrollRef.current?.getInnerViewRef?.();
    if (!fila || !interior) return;
    fila.measureLayout(interior, (_x, y) =>
      scrollRef.current?.scrollTo({ y: Math.max(0, y - insets.top - spacing.lg), animated: true }),
    );
  };

  const editar = (campo: CampoDato) => {
    setBorrador(perfil[campo] ?? '');
    setErrorBorrador(undefined);
    setEditando(campo);
    verFila(campo);
  };

  const cambiarBorrador = (campo: CampoDato, texto: string) =>
    setBorrador(campo === 'yapeNumero' ? texto.replace(/\D/g, '') : texto);

  const guardarDato = async (campo: CampoDato) => {
    const error = campo === 'yapeNumero' ? validarNumeroYape(borrador.trim()) : null;
    if (error) {
      setErrorBorrador(error);
      return;
    }
    await guardarPerfil({ [campo]: borrador.trim() } as Partial<Perfil>);
    setEditando(null);
  };

  const abrirHoja = (producto: Producto) => {
    setEnHoja(producto);
    setHojaVisible(true);
  };

  const abrirFormularioProducto = (producto?: Producto) => {
    setProductoEditado(producto ?? null);
    setFormularioProducto(producto
      ? { nombre: producto.nombre, unidad: producto.unidad, precioVenta: producto.precioVenta, costoUnitario: producto.costoUnitario }
      : { nombre: '', unidad: 'unidad', precioVenta: 0, costoUnitario: 0 });
    setErroresProducto({});
    setPrecioTexto(producto ? String(producto.precioVenta) : '');
    setCostoTexto(producto ? String(producto.costoUnitario) : '');
  };

  const guardarFormularioProducto = async () => {
    if (!formularioProducto) return;
    const datos = {
      ...formularioProducto,
      precioVenta: precioTexto.trim() ? Number(precioTexto.replace(',', '.')) : NaN,
      costoUnitario: costoTexto.trim() ? Number(costoTexto.replace(',', '.')) : NaN,
    };
    const resultado = productoEditado
      ? await editarProducto(productoEditado.id, datos)
      : await crearProducto(datos);
    if (!resultado.ok) {
      setErroresProducto(resultado.errores);
      return;
    }
    setFormularioProducto(null);
    setProductoEditado(null);
  };

  const filaDato = ({ campo, etiqueta, ayuda }: DatoEditable, separada: boolean) => (
    <View
      key={campo}
      ref={fila => {
        filas.current[campo] = fila;
      }}
      style={[styles.filaDato, separada && styles.separador]}
    >
      {editando === campo ? (
        <View style={styles.edicion}>
          <Input
            label={etiqueta}
            value={borrador}
            onChangeText={texto => cambiarBorrador(campo, texto)}
            error={errorBorrador}
            autoFocus
            autoCapitalize={campo === 'yapeNumero' ? 'none' : 'words'}
            keyboardType={campo === 'yapeNumero' ? 'phone-pad' : 'default'}
            maxLength={campo === 'yapeNumero' ? 9 : undefined}
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
  );

  return (
    <View style={styles.pantalla}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        // iOS: suma al final el alto del teclado y sube el campo enfocado a la vista, para
        // que la fila que se edita no quede tapada. Android ya reduce la ventana (adjustResize).
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.scroll}
        testID="perfil-scroll"
      >
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
          <AvatarPerfil
            perfil={perfil}
            tamano={96}
            fondo="primaryPressed"
            borde={3}
            textoVariant="display"
            testIDFoto="perfil-avatar-foto"
            testIDIniciales="perfil-iniciales"
          />
          <Text variant="h2" color="textInverse" align="center" testID="perfil-nombre">
            {perfil.nombre || 'Agrega tu nombre'}
          </Text>
          {perfil.negocio ? (
            <Text color="textInverse" align="center">
              {perfil.negocio}
            </Text>
          ) : null}

          {/* Cada acción de la foto lleva su texto: ningún ícono suelto (UX, regla 1). */}
          {hayFoto ? (
            <View style={styles.fotoAcciones}>
              <Button
                title="Cambiar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={pedirCambiarFoto}
                testID="perfil-foto-cambiar"
              />
              <Button
                title="Quitar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={pedirQuitarFoto}
                testID="perfil-foto-quitar"
              />
            </View>
          ) : (
            <View style={styles.fotoAcciones}>
              <Button
                title="Elegir de la galería"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('galeria')}
                testID="perfil-foto-galeria"
              />
              <Button
                title="Tomar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('camara')}
                testID="perfil-foto-camara"
              />
            </View>
          )}

          {hayFoto && cambiandoFoto ? (
            <View style={styles.fotoPanel} testID="perfil-foto-cambiar-panel">
              <Button
                title="Elegir de la galería"
                variant="outline"
                fullWidth
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('galeria')}
                testID="perfil-foto-cambiar-galeria"
              />
              <Button
                title="Tomar foto"
                variant="outline"
                fullWidth
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('camara')}
                testID="perfil-foto-cambiar-camara"
              />
              <Button
                title="Cancelar"
                variant="ghost"
                fullWidth
                onPress={() => setCambiandoFoto(false)}
                testID="perfil-foto-cambiar-cancelar"
              />
            </View>
          ) : null}

          {hayFoto && confirmandoQuitar ? (
            <View style={styles.fotoPanel} testID="perfil-foto-quitar-panel">
              <Text align="center">¿Quitar tu foto? Se va a ver tu inicial.</Text>
              <Button
                title="Sí, quitar"
                variant="danger"
                fullWidth
                onPress={confirmarQuitarFoto}
                testID="perfil-foto-quitar-si"
              />
              <Button
                title="No, dejarla"
                variant="outline"
                fullWidth
                onPress={() => setConfirmandoQuitar(false)}
                testID="perfil-foto-quitar-no"
              />
            </View>
          ) : null}

          {errorFoto ? (
            <Text variant="bodySmall" color="textInverse" align="center" testID="perfil-foto-error">
              {errorFoto}
            </Text>
          ) : null}
        </SafeAreaView>

        <View style={styles.contenido}>
          <View style={styles.seccion}>
            <Text variant="h3">Mis datos</Text>
            <View style={styles.tarjeta}>
              {DATOS.map((dato, i) => filaDato(dato, i > 0))}
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
              {perfil.aceptaYape ? (
                <View style={styles.separador}>
                  {filaDato(YAPE_NUMERO, false)}
                  {perfil.yapeAjeno ? (
                    <>
                      {filaDato(YAPE_TITULAR, true)}
                      {filaDato(YAPE_PARENTESCO, true)}
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.seccion}>
            <View>
              <Text variant="h3">Mis productos</Text>
              <Text variant="caption" color="textMuted">
                El precio de venta y el costo estimado permiten comparar tus productos.
              </Text>
            </View>
            <Button title="Agregar producto" variant="outline" onPress={() => abrirFormularioProducto()} testID="agregar-producto" />
            {productos.length === 0 ? (
              <View style={styles.tarjetaProducto}>
                <Text>Agrega lo que vendes para registrar tu día.</Text>
                <Button title="Cargar datos de ejemplo" variant="ghost" onPress={cargarDatosDeEjemplo} disabled={semilla === 'cargando'} testID="cargar-ejemplo-perfil" />
              </View>
            ) : null}
            {formularioProducto ? (
              <View style={styles.tarjetaProducto} testID="formulario-producto">
                <Text variant="h3">{productoEditado ? 'Editar producto' : 'Nuevo producto'}</Text>
                <Input label="Nombre" value={formularioProducto.nombre} onChangeText={nombre => setFormularioProducto({ ...formularioProducto, nombre })} error={erroresProducto.nombre} testID="producto-nombre" />
                <Input label="Unidad de venta" value={formularioProducto.unidad} onChangeText={unidad => setFormularioProducto({ ...formularioProducto, unidad })} error={erroresProducto.unidad} testID="producto-unidad" />
                <Input label="Precio de venta" value={precioTexto} onChangeText={setPrecioTexto} error={erroresProducto.precioVenta} keyboardType="decimal-pad" testID="producto-precio" />
                <Input label="Costo estimado" value={costoTexto} onChangeText={setCostoTexto} error={erroresProducto.costoUnitario} keyboardType="decimal-pad" testID="producto-costo" />
                <Button title="Guardar producto" onPress={guardarFormularioProducto} testID="guardar-producto" />
                <Button title="Cancelar" variant="ghost" onPress={() => setFormularioProducto(null)} testID="cancelar-producto" />
              </View>
            ) : null}
            {productos.map(p => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  hoy={hoy}
                  onCambiarPrecio={() => abrirHoja(p)}
                  onEditar={() => abrirFormularioProducto(p)}
                  onActivo={() => establecerProductoActivo(p.id, !p.activo)}
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
  onEditar,
  onActivo,
}: {
  producto: Producto;
  hoy: string;
  onCambiarPrecio: () => void;
  onEditar: () => void;
  onActivo: () => void;
}) => {
  const deja = teDeja(producto);
  const revision = requiereRevision(producto, hoy);
  return (
    <View style={styles.tarjetaProducto} testID={`producto-${producto.id}`}>
      <View style={styles.filaProducto}>
        <Text variant="bodyStrong">{producto.nombre}</Text>
        <Text variant="h3">{formatoSoles(producto.precioVenta)}</Text>
      </View>
      {!producto.activo ? <Text color="textMuted">Inactivo</Text> : null}
      <Text variant="bodySmall" color="textMuted">
        Costo estimado {formatoSoles(producto.costoUnitario)} ·{' '}
        <Text variant="bodySmall" color={deja.monto < 0 ? 'danger' : 'success'}>
          Diferencia estimada por unidad {formatoSoles(deja.monto)}
        </Text>{' '}
        · {deja.porcentaje}%
      </Text>
      <Text variant="caption" color="textMuted">Precio de venta menos costo estimado por unidad.</Text>
      <View style={styles.filaProducto}>
        <View style={styles.actualizado}>
          <Icon icon={Clock} size="sm" color="textMuted" />
          <Text variant="caption" color="textMuted" style={styles.actualizadoTexto}>
            Precio actualizado el {formatoFechaCorta(producto.actualizadoEn)}
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
      <View style={styles.acciones}>
        <Button title="Editar" variant="ghost" onPress={onEditar} testID={`editar-producto-${producto.id}`} />
        <Button title={producto.activo ? 'Desactivar' : 'Reactivar'} variant="ghost" onPress={onActivo} testID={`activo-producto-${producto.id}`} />
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
  fotoAcciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fotoPanel: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
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
