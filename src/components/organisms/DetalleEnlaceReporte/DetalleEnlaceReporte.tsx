// src/components/organisms/DetalleEnlaceReporte/DetalleEnlaceReporte.tsx
// El enlace de un reporte en la nube: su QR, su código, la dirección en texto, cuándo caduca y los botones
// "Copiar enlace", "Compartir enlace" y "Descargar PDF" (este último solo mientras el enlace vale). Lo usan la
// hoja de Mi reporte y el detalle de Mis reportes. Todo botón lleva texto. Nada sale del teléfono hasta que la
// persona toca uno, y solo abre la hoja de compartir o la descarga del propio enlace.
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Copy, Download, Share2 } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { CodigoQR } from '@components/molecules/CodigoQR';
import { codigoDeEnlace, modulosQR, textoCaduca } from '@analisis/pasaporte';
import { formatoFechaCorta } from '@dominio/formato';
import { fechaLocal } from '@dominio/fecha';
import { copiarEnlace } from '@services/reporteNube';
import { compartirReporte } from '@services/compartir';

/** Lado del QR del enlace, en dp. */
const TAMANO_QR_ENLACE = 200;

export interface DetalleEnlaceReporteProps {
  id: string;
  url: string;
  caduca: string;
  /** `false`: el enlace ya caducó; no se ofrece descargar y la fecha dice «Caducó el …». */
  vigente?: boolean;
  /** Prefijo de los testID (`<prefijo>-qr`, `-codigo`, `-url`, `-caduca`, `-copiar`, `-compartir`, `-descargar`, `-aviso`). */
  prefijo: string;
}

export const DetalleEnlaceReporte = ({
  id,
  url,
  caduca,
  vigente = true,
  prefijo,
}: DetalleEnlaceReporteProps) => {
  const modulos = useMemo(() => modulosQR(url), [url]);
  const [aviso, setAviso] = useState<string | null>(null);
  const codigo = codigoDeEnlace(id);

  const copiar = () =>
    setAviso(copiarEnlace(url) ? 'Enlace copiado.' : 'No pude copiarlo. Usa "Compartir enlace".');
  const compartir = async () => {
    const r = await compartirReporte(`Mi reporte de Crecemos. ${textoCaduca(caduca)}: ${url}`);
    setAviso(
      r?.ok === false ? 'No pudimos abrir la hoja para compartir. Inténtalo otra vez.' : null,
    );
  };
  const descargar = async () => {
    try {
      await Linking.openURL(`${url}?descargar=1`);
      setAviso(null);
    } catch {
      setAviso('No pude abrir la descarga. Usa "Compartir enlace".');
    }
  };

  return (
    <View style={styles.contenido}>
      <CodigoQR
        modulos={modulos}
        codigo={codigo}
        etiqueta="Código QR del enlace de tu reporte"
        size={TAMANO_QR_ENLACE}
        testID={`${prefijo}-qr`}
      />
      <Text variant="bodyStrong" testID={`${prefijo}-codigo`}>
        {codigo}
      </Text>
      <Text variant="bodySmall" selectable testID={`${prefijo}-url`}>
        {url}
      </Text>
      <Text variant="bodyStrong" testID={`${prefijo}-caduca`}>
        {vigente
          ? textoCaduca(caduca)
          : `Caducó el ${formatoFechaCorta(fechaLocal(new Date(caduca)))}`}
      </Text>
      <Text variant="bodySmall" color="textMuted">
        {vigente
          ? 'Cualquiera que tenga este enlace puede ver y descargar el reporte hasta esa fecha.'
          : 'Este enlace ya no funciona.'}
      </Text>
      <Button
        title="Copiar enlace"
        leftIcon={Copy}
        variant="outline"
        fullWidth
        onPress={copiar}
        testID={`${prefijo}-copiar`}
      />
      <Button
        title="Compartir enlace"
        leftIcon={Share2}
        variant="outline"
        fullWidth
        onPress={compartir}
        testID={`${prefijo}-compartir`}
      />
      {vigente ? (
        <Button
          title="Descargar PDF"
          leftIcon={Download}
          variant="outline"
          fullWidth
          onPress={descargar}
          testID={`${prefijo}-descargar`}
        />
      ) : null}
      {aviso !== null ? (
        <Text variant="bodySmall" accessibilityLiveRegion="polite" testID={`${prefijo}-aviso`}>
          {aviso}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  contenido: { gap: spacing.md, alignItems: 'center' },
});
