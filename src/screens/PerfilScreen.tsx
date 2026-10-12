// src/screens/PerfilScreen.tsx
// "Mi perfil": foto y datos de quien usa la app, cómo le pagan, el recordatorio diario, sus
// productos y los datos de ejemplo (cargarlos o borrarlos).
// Es la pantalla que hace posible el insight: sin precio y costo no hay "Te deja".
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Clock, TriangleAlert } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { mensajeBorrarEjemplo } from '@dominio/origen';
import { MensajeError } from '@components/atoms/MensajeError';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Input } from '@components/atoms/Input';
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { ChipGroup } from '@components/molecules/ChipGroup';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { CambiarPrecioSheet } from '@components/organisms/CambiarPrecioSheet';
import { fechaLocal } from '@dominio/fecha';
import { ajustesDeRecordatorio, OPCIONES_HORA_RECORDATORIO } from '@dominio/recordatorio';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import { avatarDe } from '@dominio/foto';
import { validarNumeroYape } from '@dominio/validacion';
import { requiereRevision, teDeja } from '@dominio/producto';
import type { DatosProducto } from '@dominio/validacion';
import type { Perfil, Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { elegirFoto, mensajeFoto } from '@services/foto';
import { avisaConLaAppCerrada, pedirPermisoDeAvisos } from '@services/recordatorio';
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
  const { perfil, productos, guardarPerfil, guardarFoto, quitarFoto, crearProducto, editarProducto, establecerProductoActivo, cargarDatosDeEjemplo, semilla, datosDeEjemplo, borrarDatosDeEjemplo } = useCrecemos();
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

  // El encabezado de Perfil es magenta: con íconos oscuros la barra de estado no se lee. Mientras
  // esta pantalla está al frente se pide el estilo claro; al salir se restaura el oscuro de la app.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle('dark-content');
    }, []),
  );

  // Cada guardado pasa por `useAccionSegura`: si falla, lo dice en su lugar en vez de callar.
  const datoSeguro = useAccionSegura(async (campo: CampoDato) => {
    const error = campo === 'yapeNumero' ? validarNumeroYape(borrador.trim()) : null;
    if (error) {
      setErrorBorrador(error);
      return;
    }
    await guardarPerfil({ [campo]: borrador.trim() } as Partial<Perfil>);
    setEditando(null);
  });
  const pagoSeguro = useAccionSegura((parcial: Partial<Perfil>) => guardarPerfil(parcial));

  // Recordatorio diario. Prender pide permiso solo cuando la persona lo toca, y antes le explica por
  // qué; si el sistema lo niega, el interruptor se queda apagado y se lo dice en palabras claras.
  const ajustesRecordatorio = ajustesDeRecordatorio(perfil);
  const [explicandoPermiso, setExplicandoPermiso] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const activarRecordatorio = useAccionSegura(async () => {
    const permiso = await pedirPermisoDeAvisos();
    setExplicandoPermiso(false);
    if (permiso !== 'concedido') {
      setPermisoNegado(true);
      return;
    }
    await guardarPerfil({ recordatorioActivo: true });
  }, 'No pudimos activar el recordatorio. Inténtalo otra vez.');
  const cambiarRecordatorio = useAccionSegura(
    (parcial: Partial<Perfil>) => guardarPerfil(parcial),
    'No pudimos guardar el recordatorio. Inténtalo otra vez.',
  );
  const alCambiarRecordatorio = (prender: boolean) => {
    activarRecordatorio.limpiarError();
    cambiarRecordatorio.limpiarError();
    setPermisoNegado(false);
    if (!prender) {
      setExplicandoPermiso(false);
      cambiarRecordatorio.ejecutar({ recordatorioActivo: false });
    } else if (avisaConLaAppCerrada()) {
      setExplicandoPermiso(true);
    } else {
      activarRecordatorio.ejecutar();
    }
  };
  const fotoSegura = useAccionSegura(async () => {
    await quitarFoto();
    setConfirmandoQuitar(false);
  }, 'No pudimos quitar tu foto. Inténtalo otra vez.');
  // Guardar o editar un producto y activarlo o desactivarlo comparten el aviso de la sección.
  const productoSeguro = useAccionSegura((tarea: () => Promise<void>) => tarea());
  // Borrar lo de ejemplo pide confirmar diciendo cuántos días se van (UX, regla 8).
  const [confirmandoBorrarEjemplo, setConfirmandoBorrarEjemplo] = useState(false);
  const borrarEjemploSeguro = useAccionSegura(async () => {
    await borrarDatosDeEjemplo();
    setConfirmandoBorrarEjemplo(false);
  }, 'No pudimos borrar los datos de ejemplo. Inténtalo otra vez.');
  const hayEjemplo = datosDeEjemplo.dias > 0 || datosDeEjemplo.productos > 0;
  const ejemploSeguro = useAccionSegura(
    () => cargarDatosDeEjemplo(),
    'No pudimos cargar los datos de ejemplo. Inténtalo otra vez.',
  );

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
    datoSeguro.limpiarError();
    setEditando(campo);
    verFila(campo);
  };

  const cambiarBorrador = (campo: CampoDato, texto: string) =>
    setBorrador(campo === 'yapeNumero' ? texto.replace(/\D/g, '') : texto);

  const abrirHoja = (producto: Producto) => {
    setEnHoja(producto);
    setHojaVisible(true);
  };

  const abrirFormularioProducto = (producto?: Producto) => {
    productoSeguro.limpiarError();
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
              onPress={() => datoSeguro.ejecutar(campo)}
              testID={`guardar-${campo}`}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setEditando(null)}
              testID={`cancelar-${campo}`}
            />
          </View>
          <MensajeError mensaje={datoSeguro.mensajeError} testID={`error-guardar-${campo}`} />
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
                onPress={() => fotoSegura.ejecutar()}
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

          <MensajeError mensaje={fotoSegura.mensajeError} color="textInverse" testID="perfil-foto-quitar-error" />

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
              <SwitchRow
                label="Acepto Yape"
                value={perfil.aceptaYape}
                onValueChange={v => pagoSeguro.ejecutar({ aceptaYape: v })}
                testID="switch-acepta-yape"
              />
              <View style={[styles.separador, styles.indentada]}>
                <SwitchRow
                  label="El Yape no está a mi nombre"
                  value={perfil.yapeAjeno}
                  disabled={!perfil.aceptaYape}
                  onValueChange={v => pagoSeguro.ejecutar({ yapeAjeno: v })}
                  testID="switch-yape-ajeno"
                />
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
              <MensajeError mensaje={pagoSeguro.mensajeError} testID="error-guardar-pagos" />
            </View>
          </View>

          <View style={styles.seccion}>
            <Text variant="h3">Recordatorio diario</Text>
            <View style={styles.tarjeta}>
              <SwitchRow
                label="Recordarme cerrar mi día"
                description={
                  avisaConLaAppCerrada()
                    ? 'Te avisamos a la hora que elijas si aún no cerraste tu día.'
                    : 'Si pasa la hora que elijas y aún no cierras tu día, te lo recordamos aquí, en Inicio. No pide ningún permiso.'
                }
                value={ajustesRecordatorio.activo}
                onValueChange={alCambiarRecordatorio}
                testID="switch-recordatorio"
              />
              {explicandoPermiso ? (
                <View style={[styles.separador, styles.panelPermiso]} testID="recordatorio-permiso-explicacion">
                  <Text variant="bodyStrong">Para avisarte necesito tu permiso</Text>
                  <Text variant="bodySmall" color="textMuted">
                    Solo lo usamos para recordarte cerrar tu día a la hora que elijas. No enviamos
                    nada a internet.
                  </Text>
                  <Button
                    title="Sí, activar el recordatorio"
                    variant="outline"
                    fullWidth
                    loading={activarRecordatorio.ejecutando}
                    onPress={() => activarRecordatorio.ejecutar()}
                    testID="recordatorio-permiso-si"
                  />
                  <Button
                    title="Ahora no"
                    variant="ghost"
                    fullWidth
                    onPress={() => setExplicandoPermiso(false)}
                    testID="recordatorio-permiso-no"
                  />
                </View>
              ) : null}
              {permisoNegado ? (
                <Text
                  variant="bodySmall"
                  style={styles.ayudaInterruptor}
                  accessibilityLiveRegion="polite"
                  testID="recordatorio-permiso-negado"
                >
                  No pudimos activar el recordatorio porque el permiso para avisarte está apagado.
                  Puedes prenderlo en los ajustes de tu teléfono y volver a intentarlo.
                </Text>
              ) : null}
              {ajustesRecordatorio.activo ? (
                <View style={[styles.separador, styles.panelPermiso]}>
                  <ChipGroup
                    label="¿A qué hora te aviso?"
                    options={OPCIONES_HORA_RECORDATORIO.map(o => ({ value: o.valor, label: o.etiqueta }))}
                    value={ajustesRecordatorio.hora}
                    onChange={hora => cambiarRecordatorio.ejecutar({ recordatorioHora: hora })}
                    testIDPrefix="recordatorio-hora"
                  />
                </View>
              ) : null}
              <MensajeError mensaje={activarRecordatorio.mensajeError} testID="error-activar-recordatorio" />
              <MensajeError mensaje={cambiarRecordatorio.mensajeError} testID="error-guardar-recordatorio" />
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
              <Card variant="bordered" style={styles.tarjetaProducto}>
                <Text>Agrega lo que vendes para registrar tu día.</Text>
                <Button title="Cargar datos de ejemplo" variant="ghost" onPress={() => ejemploSeguro.ejecutar()} disabled={semilla === 'cargando' || ejemploSeguro.ejecutando} testID="cargar-ejemplo-perfil" />
                <MensajeError mensaje={ejemploSeguro.mensajeError} testID="error-cargar-ejemplo" />
              </Card>
            ) : null}
            {formularioProducto ? (
              <Card variant="bordered" style={styles.tarjetaProducto} testID="formulario-producto">
                <Text variant="h3">{productoEditado ? 'Editar producto' : 'Nuevo producto'}</Text>
                <Input label="Nombre" value={formularioProducto.nombre} onChangeText={nombre => setFormularioProducto({ ...formularioProducto, nombre })} error={erroresProducto.nombre} testID="producto-nombre" />
                <Input label="Unidad de venta" value={formularioProducto.unidad} onChangeText={unidad => setFormularioProducto({ ...formularioProducto, unidad })} error={erroresProducto.unidad} testID="producto-unidad" />
                <Input label="Precio de venta" value={precioTexto} onChangeText={setPrecioTexto} error={erroresProducto.precioVenta} keyboardType="decimal-pad" testID="producto-precio" />
                <Input label="Costo estimado" value={costoTexto} onChangeText={setCostoTexto} error={erroresProducto.costoUnitario} keyboardType="decimal-pad" testID="producto-costo" />
                <MensajeError mensaje={productoSeguro.mensajeError} testID="error-guardar-producto" />
                <Button title="Guardar producto" onPress={() => productoSeguro.ejecutar(guardarFormularioProducto)} testID="guardar-producto" />
                <Button title="Cancelar" variant="ghost" onPress={() => setFormularioProducto(null)} testID="cancelar-producto" />
              </Card>
            ) : null}
            {formularioProducto ? null : (
              <MensajeError mensaje={productoSeguro.mensajeError} testID="error-producto-seccion" />
            )}
            {productos.map(p => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  hoy={hoy}
                  onCambiarPrecio={() => abrirHoja(p)}
                  onEditar={() => abrirFormularioProducto(p)}
                  onActivo={() => productoSeguro.ejecutar(() => establecerProductoActivo(p.id, !p.activo))}
                />
              ))}
          </View>

          {hayEjemplo ? (
            <View style={styles.seccion} testID="perfil-datos-ejemplo">
              <View>
                <Text variant="h3">Datos de ejemplo</Text>
                <Text variant="caption" color="textMuted">
                  Vinieron con la demostración. No cuentan en el reporte para tu banco cuando ya tienes
                  tus propios días.
                </Text>
              </View>
              {confirmandoBorrarEjemplo ? (
                <View style={styles.tarjetaProducto}>
                  <Text variant="bodyStrong" accessibilityLiveRegion="polite" testID="borrar-ejemplo-mensaje">
                    {mensajeBorrarEjemplo(datosDeEjemplo)}
                  </Text>
                  <MensajeError mensaje={borrarEjemploSeguro.mensajeError} testID="error-borrar-ejemplo" />
                  <Button
                    title="Sí, borrar los de ejemplo"
                    variant="danger"
                    fullWidth
                    loading={borrarEjemploSeguro.ejecutando}
                    onPress={() => borrarEjemploSeguro.ejecutar()}
                    testID="borrar-ejemplo-si"
                  />
                  <Button
                    title="No, dejarlos"
                    variant="outline"
                    fullWidth
                    onPress={() => setConfirmandoBorrarEjemplo(false)}
                    testID="borrar-ejemplo-no"
                  />
                </View>
              ) : (
                <Button
                  title="Borrar datos de ejemplo"
                  variant="outline"
                  fullWidth
                  onPress={() => {
                    borrarEjemploSeguro.limpiarError();
                    setConfirmandoBorrarEjemplo(true);
                  }}
                  testID="borrar-ejemplo"
                />
              )}
            </View>
          ) : null}
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
    <Card variant="bordered" style={styles.tarjetaProducto} testID={`producto-${producto.id}`}>
      <View style={styles.filaProducto}>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          style={styles.nombreProducto}
          testID={`producto-nombre-${producto.id}`}
        >
          {producto.nombre}
        </Text>
        <Text variant="h3" numberOfLines={1} style={styles.precioProducto}>
          {formatoSoles(producto.precioVenta)}
        </Text>
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
      <View style={styles.actualizado}>
        <Icon icon={Clock} size="sm" color="textMuted" />
        <Text variant="caption" color="textMuted" style={styles.actualizadoTexto}>
          Precio actualizado el {formatoFechaCorta(producto.actualizadoEn)}
        </Text>
      </View>
      {/* Tres botones con texto no caben en una fila a 360 dp: la fila se parte en dos. */}
      <View style={styles.accionesProducto} testID={`acciones-producto-${producto.id}`}>
        <Button
          title="Cambiar precio"
          variant="ghost"
          onPress={onCambiarPrecio}
          accessibilityLabel={`Cambiar precio de ${producto.nombre}`}
          testID={`cambiar-precio-${producto.id}`}
        />
        <Button title="Editar" variant="ghost" onPress={onEditar} testID={`editar-producto-${producto.id}`} />
        <Button title={producto.activo ? 'Desactivar' : 'Reactivar'} variant="ghost" onPress={onActivo} testID={`activo-producto-${producto.id}`} />
      </View>
      {revision.revisar ? (
        <Callout icon={TriangleAlert} style={styles.aviso} testID={`aviso-precio-${producto.id}`}>
          {revision.mensaje}
        </Callout>
      ) : null}
    </Card>
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
  indentada: { paddingLeft: spacing.lg },
  ayudaInterruptor: { paddingBottom: spacing.md },
  panelPermiso: { paddingVertical: spacing.md, gap: spacing.sm },
  tarjetaProducto: { backgroundColor: colors.background, gap: spacing.xs },
  filaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nombreProducto: { flex: 1 },
  precioProducto: { flexShrink: 0 },
  accionesProducto: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actualizado: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actualizadoTexto: { flex: 1 },
  aviso: { marginTop: spacing.sm },
});
