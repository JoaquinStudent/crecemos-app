"""Genera los íconos de Android de Crecemos desde assets/icono/logo.png.

Uso (desde la raíz del proyecto):  python -I scripts/generar-iconos.py
Necesita Pillow. Escribe en android/app/src/main/res: mipmap-*/ic_launcher.png (cuadrado, Android
viejos), ic_launcher_round.png (redondo), ic_launcher_foreground.png (capa frontal del ícono
adaptativo, Android 8+), mipmap-anydpi-v26/*.xml y values/ic_launcher_background.xml.
"""
from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
LOGO = RAIZ / "assets" / "icono" / "logo.png"
RES = RAIZ / "android" / "app" / "src" / "main" / "res"

# Ícono clásico: 48 dp por densidad. Capa frontal adaptativa: 108 dp por densidad.
DENSIDADES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
# El sistema recorta el ícono adaptativo (círculo, cuadrado redondeado…): solo los 66 dp centrales
# de 108 están siempre a la vista. El logo ocupa ~72 % del ancho, así que se encoge para que su
# texto no se corte con la máscara redonda.
ESCALA_FRONTAL = 0.84
BORDE_SUAVE = 24  # px (en 1254) de fundido entre el logo y el fondo plano


def color_de_fondo(logo: Image.Image) -> tuple[int, int, int]:
    """La mediana de los bordes: el fondo del logo tiene algo de textura y un valor medio la ignora."""
    ancho, alto = logo.size
    muestras = []
    for i in range(0, ancho, 8):
        muestras += [logo.getpixel((i, 2)), logo.getpixel((i, alto - 3))]
    for j in range(0, alto, 8):
        muestras += [logo.getpixel((2, j)), logo.getpixel((ancho - 3, j))]
    return tuple(int(median(c[k] for c in muestras)) for k in range(3))


def capa_frontal(logo: Image.Image, fondo: tuple[int, int, int], lado: int) -> Image.Image:
    """Lienzo plano con el logo achicado al centro y sus bordes fundidos con el fondo."""
    tam = round(lado * ESCALA_FRONTAL)
    chico = logo.resize((tam, tam), Image.LANCZOS)
    mascara = Image.new("L", (tam, tam), 0)
    margen = max(2, round(BORDE_SUAVE * tam / logo.width))
    ImageDraw.Draw(mascara).rectangle((margen, margen, tam - margen, tam - margen), fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(margen / 2))
    lienzo = Image.new("RGB", (lado, lado), fondo)
    lienzo.paste(chico, ((lado - tam) // 2, (lado - tam) // 2), mascara)
    return lienzo


def redondo(img: Image.Image) -> Image.Image:
    lado = img.width
    mascara = Image.new("L", (lado * 4, lado * 4), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    mascara = mascara.resize((lado, lado), Image.LANCZOS)
    salida = img.convert("RGBA")
    salida.putalpha(mascara)
    return salida


def main() -> None:
    logo = Image.open(LOGO).convert("RGB")
    fondo = color_de_fondo(logo)
    hexa = "#%02X%02X%02X" % fondo
    for nombre, factor in DENSIDADES.items():
        carpeta = RES / f"mipmap-{nombre}"
        carpeta.mkdir(parents=True, exist_ok=True)
        clasico = logo.resize((round(48 * factor), round(48 * factor)), Image.LANCZOS)
        clasico.save(carpeta / "ic_launcher.png", optimize=True)
        redondo(clasico).save(carpeta / "ic_launcher_round.png", optimize=True)
        capa_frontal(logo, fondo, round(108 * factor)).save(
            carpeta / "ic_launcher_foreground.png", optimize=True
        )

    adaptativo = RES / "mipmap-anydpi-v26"
    adaptativo.mkdir(parents=True, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        "</adaptive-icon>\n"
    )
    (adaptativo / "ic_launcher.xml").write_text(xml, encoding="utf-8")
    (adaptativo / "ic_launcher_round.xml").write_text(xml, encoding="utf-8")
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{hexa}</color>\n</resources>\n',
        encoding="utf-8",
    )
    print(f"Listo. Fondo del ícono adaptativo: {hexa}")


if __name__ == "__main__":
    main()
