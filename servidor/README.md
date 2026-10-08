# Servidor intermedio del chat "Preguntarle a mis datos"

Un Cloudflare Worker. **La app nunca habla con OpenRouter**: habla con este Worker, que guarda la
clave como secreto y reenvía solo lo necesario.

| La app manda                                                    | El Worker hace                                                                                                                       | Responde                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `{ "tipo": "interpretar", "texto": "¿cuánto vendí ayer?" }`     | Pide a **Jev** (API tipada) que elija una de las 12 preguntas conocidas. Si Jev falla o responde algo inválido, lo hace **DeepSeek** | `{ intencion, producto, dia, confianza, modelo }` |
| `{ "tipo": "redactar", "hecho": { intencion, frase, cifras } }` | Pide a **DeepSeek** que diga la frase con otras palabras                                                                             | `{ texto }`                                       |

Todo pasa por OpenRouter, con **la misma clave** (`OPENROUTER_API_KEY`) para las dos APIs:

- **Jev** clasifica por la API tipada, `https://openrouter.ai/api/v1/systemone`: se le manda el texto
  de la pregunta y tres preguntas de opción (la intención, el producto y el día) y devuelve la opción
  elegida con su confianza. Jev no genera texto, solo decide.
- **DeepSeek** (respaldo para clasificar y único que redacta) va por el chat,
  `https://openrouter.ai/api/v1/chat/completions`, con salidas estructuradas (JSON con valores
  permitidos).

Las cifras las calcula siempre el código de la app; la app descarta cualquier redacción que cambie
una sola cifra.

Archivos: `worker.js` (el código), `wrangler.toml` (la configuración, **sin la clave**) y este
`README.md`.

## Pasos (una sola vez)

Ya hiciste `npx wrangler login`. Tu subdominio es `joaquiningsoft`.

### 1. Entrar a la carpeta

```sh
cd servidor
```

### 2. Publicar el Worker

```sh
npx wrangler deploy
```

Al terminar debe mostrar la dirección:

```
https://crecemos-asistente.joaquiningsoft.workers.dev
```

Esa dirección ya está en `src/config.ts` (`JEV_URL`). Hasta el paso 3 el Worker responde
`{"error":"NO_CONFIGURADO"}`: es lo esperado.

Si `wrangler` se queja del límite por IP (`ratelimits`), actualiza con `npx wrangler@latest deploy`
(hace falta la versión 4.36.0 o más nueva) o cambia el número de `namespace_id` en `wrangler.toml`
por otro entero.

### 3. Guardar la clave de OpenRouter (nunca en un archivo ni en el chat)

Crea la clave en <https://openrouter.ai/settings/keys> y ponle un **tope de gasto** (ver el punto 8).
Después:

```sh
npx wrangler secret put OPENROUTER_API_KEY
```

Cuando lo pida, **pega la clave y presiona Enter**. No se ve lo que pegas; es normal. La clave queda
guardada en Cloudflare, no en tu computadora ni en el repositorio.

### 4. Probar con `curl` (desde tu terminal)

La clave **no** se usa en el `curl`: va dentro del Worker.

Interpretar una pregunta:

```sh
curl -s -X POST https://crecemos-asistente.joaquiningsoft.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"interpretar","texto":"¿cuánto vendí ayer?"}'
```

Debe responder algo como (los números y la versión de `modelo` cambian):

```json
{
  "intencion": "ventaDelDia",
  "producto": "ninguno",
  "dia": "ayer",
  "confianza": 0.95,
  "modelo": "typesafe/jev-1.13-20260917"
}
```

Redactar una respuesta ya calculada:

```sh
curl -s -X POST https://crecemos-asistente.joaquiningsoft.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"redactar","hecho":{"intencion":"ventaDelDia","frase":"Ayer, martes 6 de octubre, vendiste S/ 205.00.","cifras":["6","205.00"]}}'
```

Debe responder algo como (las palabras cambian, las cifras no):

```json
{ "texto": "Ayer, martes 6 de octubre, te entraron S/ 205.00." }
```

Si responde un error:

| Respuesta                           | Qué significa                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `{"error":"NO_CONFIGURADO"}`        | Falta el paso 3 (la clave)                                                                                                              |
| `{"error":"NO_DISPONIBLE"}`         | Ningún modelo contestó a tiempo o con la forma pedida. Revisa el saldo y el tope de la clave en OpenRouter, y los proveedores (punto 8) |
| `{"error":"DEMASIADAS_PETICIONES"}` | Pasaste las 20 peticiones por minuto de tu IP; espera un minuto                                                                         |
| `{"error":"SOLICITUD_INVALIDA"}`    | El cuerpo no tiene la forma pedida (texto de 1 a 200 caracteres, frase de hasta 300)                                                    |

### 5. Saber quién respondió: Jev o el respaldo

Mira el campo `modelo` de la respuesta de `interpretar`:

- Empieza con `typesafe/jev-` (por ejemplo `typesafe/jev-1.13-20260917`): respondió **Jev**, por la
  API tipada. Es lo esperable.
- `deepseek/deepseek-v4-flash`: Jev falló y respondió el **respaldo DeepSeek**.

Si ves `jev-latest` tal cual, la API no informó la versión y se muestra el modelo configurado; también
es Jev. Anota lo que ves: es la prueba real que pide el SPEC (M11 de la auditoría). La app ignora
este campo.

Prueba también una pregunta que no es del negocio, por ejemplo `"texto":"¿qué hora es?"`: debe volver
`"intencion":"noEntendi"` o una `confianza` baja (la app descarta lo que está por debajo de 0.6).

### 6. Ver que el Worker está vivo

```sh
npx wrangler tail
```

Muestra una línea por petición (hora, resultado). **No muestra lo que preguntó Freddy**: el Worker no
escribe ningún log con contenido y `tail` no muestra el cuerpo de las peticiones. Para salir:
`Ctrl+C`.

### 7. Rotar la clave

1. En OpenRouter (<https://openrouter.ai/settings/keys>) crea **otra** clave, con su tope de gasto.
2. `npx wrangler secret put OPENROUTER_API_KEY` y pega la nueva (reemplaza a la anterior al instante).
3. Repite las pruebas del paso 4.
4. Borra la clave vieja en OpenRouter.

Hazlo también si la clave se pegó por error en un chat, un archivo o una captura.

### 8. Si algo falla o se encarece

**Si Jev no responde** (el campo `modelo` sale siempre `deepseek/deepseek-v4-flash`): no hay que
hacer nada, el Worker pasa solo a DeepSeek, pero cada pregunta puede tardar hasta 4 segundos de más.
Revisa que la clave tenga saldo y que no haya llegado a su tope. Para fijar una versión de Jev en vez
del alias, cambia `JEV_MODELO` en `wrangler.toml` (por ejemplo `jev-1.13`) y vuelve a publicar con
`npx wrangler deploy`. Debe ser un id de la API tipada de Jev (`jev-latest` o `jev-1.x`), no un modelo
de chat. Lo mismo con `DEEPSEEK_MODELO`, que sí es un modelo de chat de OpenRouter que acepte salidas
estructuradas.

**Cómo decide Jev:** devuelve una `confidence` de 0 a 1 que mide qué tan concentrada está la
probabilidad en una opción. Con 12 opciones, una opción con 60 % de probabilidad da una confianza de
unos 0.56: un poco por debajo del mínimo de la app (0.6), que entonces dice "No entendí". Si pasa
seguido con preguntas claras, la solución es mejorar las descripciones de `PREGUNTAS_JEV` en
`worker.js`, no bajar el mínimo.

**Proveedores de DeepSeek:** `DEEPSEEK_PROVEEDORES` (en `wrangler.toml`) lista los proveedores
permitidos, con el nombre que usa OpenRouter. El valor actual es `deepinfra,parasail,cloudflare,digitalocean`:
empresas de EE. UU. que aceptan salidas estructuradas para este modelo. Se cambia con el mismo
`npx wrangler deploy`. Si OpenRouter deja de listar alguno, mira los nombres vigentes en
<https://openrouter.ai/deepseek/deepseek-v4-flash/providers>.

**Poner un tope de gasto a la clave:** en <https://openrouter.ai/settings/keys>, al crear la clave
(o al editarla) completa el campo del **límite de créditos** de la clave (en inglés, _credit limit_)
con un monto bajo, por ejemplo 2 dólares, y, si quieres, que se reinicie cada día o cada mes. Cuando se
acaba, OpenRouter rechaza las peticiones de esa clave y el chat dice "Necesitas internet para esto".

### 9. Riesgos conocidos (dichos de frente)

- **El endpoint es público.** Cualquiera que conozca la dirección puede mandar peticiones y gastar
  los créditos de la clave hasta su tope. No hay inicio de sesión (Freddy no tiene cuenta).
  Mitigaciones del MVP: texto de hasta 200 caracteres y cuerpo de hasta 2 KB, validación de todo lo
  que entra y sale, un tope de gasto en la clave y un límite de 20 peticiones por minuto por IP en
  cada ubicación de Cloudflare. El límite por IP es aproximado (muchas personas pueden compartir una
  IP en una red móvil) y no reemplaza a una autenticación real, que queda para después del MVP.
- **Los totales los procesan terceros.** La pregunta y algunos totales (nunca el nombre, el Yape ni
  los movimientos) pasan por OpenRouter y por el proveedor que aloje el modelo. El Worker pide
  `data_collection: "deny"` (proveedores que no guardan ni entrenan con los datos) y, para DeepSeek,
  solo proveedores de EE. UU. Eso **reduce** el riesgo, no lo elimina. La llamada a Jev no restringe
  el proveedor (la API tipada solo admite `data_collection`, `zdr` y `allow_fallbacks`): solo exige que
  no guarde datos. Si TypeSafe no cumpliera ese requisito, OpenRouter rechazaría la llamada y siempre
  respondería el respaldo.
- **Jev en OpenRouter es reciente.** La ruta de Decisions todavía se llama `alpha` en su referencia
  y la API tipada puede cambiar. Si cambia la forma de la respuesta, el Worker la rechaza y responde
  el respaldo DeepSeek, sin romper la app.
- **Sin registros.** El Worker no escribe ningún log con la pregunta ni con la frase. Aun así,
  OpenRouter y el proveedor tienen sus propias políticas.
