import OpenAI from "openai";
import type { ArchivoImagen, ArchivoTexto } from "./file-extractors";
import { calcularCostoUSD } from "./openai-pedido.costo";
import {
  MODELOS_SIN_TEMPERATURA,
  type ExtraerPedidoInput,
  type ResultadoExtraccion,
  type UsoOpenAI,
} from "./openai-pedido.tipos";
import { RESPONSE_SCHEMA } from "./openai-pedido.schema";
import {
  buildSystemPromptPedido,
  buildUserContent,
} from "./openai-pedido.prompt";
import { postprocesarPedido } from "./openai-pedido.postproceso";

export { calcularCantidadDesdeCajas, pesoPorCajaKg } from "./utils/empaque-lineas";
export {
  formatISO,
  normalizarFechaConocida,
  resolverFechaEntrega,
  sumarDias,
} from "./utils/clasificar-adjunto-oc-mensual";
export { calcularCostoUSD } from "./openai-pedido.costo";
export {
  MODELOS_SIN_TEMPERATURA,
  type LineaExtraida,
  type PedidoExtraido,
  type ResultadoExtraccion,
  type UsoOpenAI,
} from "./openai-pedido.tipos";
export {
  INTERPRETACION_RESPONSE_SCHEMA,
  INTERPRETACION_SYSTEM_PROMPT,
  interpretarInstruccionChat,
  interpretarInstruccionConReglas,
  type ContextoInterpretacionChat,
  type IntencionChatOt,
  type InterpretacionInstruccionChat,
} from "./interpretar-instruccion-chat";

/** La respuesta del modelo se cortó por el tope de salida (`finish_reason: "length"`). */
export class ExtraccionTruncadaError extends Error {
  constructor(readonly tokensSalida: number | null) {
    super(
      `La respuesta del modelo se cortó por el tope de salida (${tokensSalida ?? "?"} tokens).`,
    );
    this.name = "ExtraccionTruncadaError";
  }
}

export async function extraerPedido({
  texto,
  archivosExtraidos,
  hoyISO,
  catalogoClaves,
  presentaciones,
}: ExtraerPedidoInput): Promise<ResultadoExtraccion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en el entorno del servidor.");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const archivosTexto = archivosExtraidos.filter(
    (f): f is ArchivoTexto => f.tipo === "texto",
  );
  const archivosImagen = archivosExtraidos.filter(
    (f): f is ArchivoImagen => f.tipo === "imagen",
  );
  const archivosNoLegibles = archivosExtraidos
    .filter((f) => f.tipo === "no_legible")
    .map((f) => f.nombre);


  const systemPrompt = buildSystemPromptPedido(catalogoClaves, presentaciones);

  // AUDITORÍA 2026-09-03 · Hallazgo #5 (Alto) — sin temperature/seed fijado, el mismo
  // input ambiguo producía salidas distintas entre llamadas (en una prueba real, 1 de 3
  // corridas del mismo archivo inventó una cantidad que la fuente no respaldaba).
  // Fix: temperature:0 minimiza (no elimina del todo — el muestreo de un LLM nunca es
  // 100% determinista incluso en temperature:0) esa variabilidad. PERO: algunos modelos
  // (confirmado en vivo con el configurado en este entorno, un modelo estilo razonamiento)
  // rechazan cualquier valor de temperature distinto del default con un 400
  // ("Unsupported value: 'temperature' does not support 0 with this model"). No hay forma
  // de saberlo de antemano por el nombre del modelo, así que se detecta al vuelo: se
  // intenta con temperature:0, y si el modelo configurado la rechaza específicamente, se
  // reintenta sin ella y se recuerda para no volver a pagar el intento fallido en cada
  // llamada futura de este mismo proceso. Al portar a WMS: aplicar el mismo patrón
  // "probar y degradar con gracia" si se permite elegir modelo libremente.
  // Hallazgo #10 (Medio) — sin retry/backoff explícito; el SDK ya trae maxRetries:2 por
  // defecto para errores retryable (429/5xx), pero quedaba implícito. Se fija explícito
  // para que quede autodocumentado en vez de depender de un default que puede cambiar
  // entre versiones del SDK.
  const messages = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: buildUserContent({ texto, archivosTexto, archivosImagen }),
    },
  ];

  const usaTemperatura = !MODELOS_SIN_TEMPERATURA.has(model);
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create(
      {
        model,
        ...(usaTemperatura ? { temperature: 0 } : {}),
        messages,
        response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
      },
      { maxRetries: 2 },
    );
  } catch (err) {
    if (
      usaTemperatura &&
      err instanceof OpenAI.APIError &&
      err.param === "temperature"
    ) {
      MODELOS_SIN_TEMPERATURA.add(model);
      completion = await client.chat.completions.create(
        {
          model,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: RESPONSE_SCHEMA,
          },
        },
        { maxRetries: 2 },
      );
    } else {
      throw err;
    }
  }

  // REQ-187: una respuesta cortada por el tope de salida del modelo no es un pedido
  // completo (medido: ~104 tokens de salida por renglón; gpt-4o corta cerca de 16k).
  // Se avisa con un error tipado para que quien llama relea por bloques de páginas
  // en vez de aceptar un JSON truncado o romperse al parsearlo.
  if (completion.choices[0]?.finish_reason === "length") {
    throw new ExtraccionTruncadaError(completion.usage?.completion_tokens ?? null);
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI no devolvió contenido.");
  }

  const pedido = postprocesarPedido({
    raw,
    texto,
    archivosExtraidos,
    archivosTexto,
    hoyISO,
    catalogoClaves,
    archivosNoLegibles,
  });

  // Base para el hallazgo "sin logging de costo" (dominio Integraciones) y el hallazgo
  // #2 (Alto, "sin límite de gasto") — decisión del Responsable: solo loguear el gasto
  // estimado, nunca bloquear una solicitud por costo. El log en sí vive en la ruta
  // que invoque este servicio; aquí solo se expone el dato.
  const uso: UsoOpenAI | null = completion.usage
    ? (() => {
        // `cache_write_tokens` aún no está en el tipo del SDK: se lee con un tipo propio.
        const detalles:
          | { cached_tokens?: number; cache_write_tokens?: number }
          | undefined = completion.usage?.prompt_tokens_details;
        const tokensCacheados = detalles?.cached_tokens ?? 0;
        const tokensCacheEscritura = detalles?.cache_write_tokens ?? 0;
        return {
          tokensEntrada: completion.usage.prompt_tokens,
          tokensEntradaCacheados: tokensCacheados,
          tokensEntradaCacheEscritura: tokensCacheEscritura,
          tokensSalida: completion.usage.completion_tokens,
          tokensTotal: completion.usage.total_tokens,
          costoUSD: calcularCostoUSD(
            model,
            completion.usage.prompt_tokens,
            tokensCacheados,
            tokensCacheEscritura,
            completion.usage.completion_tokens,
          ),
        };
      })()
    : null;

  return { pedido, uso };
}
