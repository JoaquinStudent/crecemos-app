// src/hooks/useFormularioProducto.ts
// El formulario de producto (nuevo o editado): sus campos, los errores en palabras claras y el
// guardado. El precio y el costo se escriben como texto (para poder teclear "0." sin que se pierda
// el punto) y se convierten al guardar. Crear y editar pasan por `CrecemosProvider`, que valida.
import { useState } from 'react';
import type { Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { useAccionSegura } from './useAccionSegura';

const aNumero = (texto: string): number =>
  texto.trim() ? Number(texto.replace(',', '.')) : Number.NaN;

export const useFormularioProducto = () => {
  const { crearProducto, editarProducto } = useCrecemos();
  const [abierto, setAbierto] = useState(false);
  const [editado, setEditado] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('unidad');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const guardar = useAccionSegura(async () => {
    const datos = {
      nombre,
      unidad,
      precioVenta: aNumero(precio),
      costoUnitario: aNumero(costo),
    };
    const resultado = editado ? await editarProducto(editado.id, datos) : await crearProducto(datos);
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    setAbierto(false);
    setEditado(null);
  });

  const abrir = (producto?: Producto) => {
    guardar.limpiarError();
    setEditado(producto ?? null);
    setNombre(producto?.nombre ?? '');
    setUnidad(producto?.unidad ?? 'unidad');
    setPrecio(producto ? String(producto.precioVenta) : '');
    setCosto(producto ? String(producto.costoUnitario) : '');
    setErrores({});
    setAbierto(true);
  };

  return {
    abierto,
    editado,
    campos: { nombre, unidad, precio, costo },
    cambiar: { nombre: setNombre, unidad: setUnidad, precio: setPrecio, costo: setCosto },
    errores,
    guardar,
    abrir,
    cerrar: () => setAbierto(false),
  };
};

export type FormularioProducto = ReturnType<typeof useFormularioProducto>;
