import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
// Infer the transaction client type from the prisma.$transaction signature
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const body = await req.json();
    const requestType = body.requestType ?? "advice";

    // Soportar un único mensaje (userMessage) o múltiples (userMessages: string[])
    let messages: string[] = [];
    if (typeof body.userMessage === "string") messages.push(body.userMessage);
    if (Array.isArray(body.userMessages)) messages = messages.concat(body.userMessages.filter((m: unknown) => typeof m === "string"));

    if (messages.length === 0) {
      return NextResponse.json({ error: "Falta el/los mensaje(s) del usuario" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usageSum = await prisma.aiUsage.aggregate({
      _sum: { creditsCharged: true },
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    const creditsUsedToday = usageSum._sum?.creditsCharged ?? 0;
    const DAILY_LIMIT = 5; // límite diario por usuario (ajustable)

    if (creditsUsedToday >= DAILY_LIMIT) {
      return NextResponse.json({ error: `Has alcanzado el límite diario de ${DAILY_LIMIT} consultas de IA` }, { status: 403 });
    }

    const idempoKey = req.headers.get("x-idempotency-key");
    if (idempoKey) {
      try {
        const existing = await prisma.aiUsage.findFirst({
          where: {
            userId,
            inputJson: { path: ["idempotencyKey"], equals: idempoKey },
          },
          orderBy: { createdAt: "desc" },
        });
        if (existing) {
          // Normalizar la salida a texto si es posible
          const normalize = (out: unknown): string | null => {
            try {
              if (!out) return null;
              if (typeof out === "string") return out;
              if (typeof out === "object" && out !== null) {
                const obj = out as Record<string, unknown>;
                if (typeof obj.message === "string") return obj.message;
                if (typeof obj.outputText === "string") return obj.outputText;
                if ("raw" in obj) {
                  const raw = obj.raw;
                  if (typeof raw === "string") return raw;
                  if (typeof raw === "object" && raw !== null) {
                    const r = raw as Record<string, unknown>;
                    if (Array.isArray(r.choices) && r.choices.length > 0) {
                      const c0 = r.choices[0];
                      if (typeof c0 === "object" && c0 !== null) {
                        const cObj = c0 as Record<string, unknown>;
                        if (typeof cObj.message === "object" && cObj.message !== null) {
                          const m = cObj.message as Record<string, unknown>;
                          if (typeof m.content === "string") return m.content;
                        }
                        if (typeof cObj.text === "string") return cObj.text;
                      }
                    }
                  }
                }
              }
              return null;
            } catch {
              return null;
            }
          };
          const norm = normalize(existing.outputJson);
          // Debug log: idempotency hit
          try {
            console.log("[AI] idempotency hit for user", userId, "key", idempoKey, "normalizedResponseExists", !!norm);
            console.log("[AI] existing.outputJson (truncated):", JSON.stringify(existing.outputJson)?.slice(0, 1000));
          } catch {
            /* ignore logging errors */
          }
          return NextResponse.json({ response: norm ?? "No se recibió respuesta de la IA." });
        }
      } catch (err: unknown) {
        console.warn("Idempotency check failed, continuing:", err);
      }
    }

    // Si es una sola consulta, intentar deduplicación rápida por mensaje en los últimos 10s
    if (messages.length === 1) {
      try {
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        const recent = await prisma.aiUsage.findFirst({
          where: {
            userId,
            createdAt: { gte: tenSecondsAgo },
            inputJson: { path: ["userMessage"], equals: messages[0] },
          },
          orderBy: { createdAt: "desc" },
        });

        if (recent) {
          return NextResponse.json({ response: recent.outputJson ?? "No se recibió respuesta de la IA." });
        }
      } catch (err: unknown) {
        console.warn("Dedup check failed, continuing:", err);
      }
    }

    // Verificar créditos disponibles antes de llamar al proveedor
    const creditsToCharge = messages.length;
    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    if (!userRecord) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    if (userRecord.aiCreditsRemaining < creditsToCharge) {
      return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
    }

    // Llamar al proveedor por cada mensaje y recolectar respuestas. No grabamos nada hasta que todas las respuestas sean válidas.
    const modelName = "google/gemini-2.0-flash-exp:free";

    // Verificar que la API key esté configurada
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[AI] missing OPENROUTER_API_KEY');
      return NextResponse.json({ error: 'Falta la configuración del proveedor de IA (OPENROUTER_API_KEY).' }, { status: 500 });
    }

  const extractText = (data: unknown): string | null => {
      // Intentar varias rutas comunes para extraer texto
      try {
        if (!data) return null;

        // Caso: top-level `choices` array (common in OpenAI-like responses)
        if (typeof data === 'object' && data !== null && 'choices' in data) {
          const d = data as Record<string, unknown>;
          const choices = d.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const c = choices[0] as Record<string, unknown>;
            if (c && typeof c === 'object') {
              const msg = c.message as Record<string, unknown> | undefined;
              if (msg && (typeof msg.content === 'string')) return msg.content;
              if (typeof c.content === 'string') return c.content;
              if (Array.isArray(c.content) && c.content.length > 0) {
                const first = c.content[0];
                if (typeof first === 'string') return first;
                if (typeof first === 'object' && first !== null) {
                  const fo = first as Record<string, unknown>;
                  if (typeof fo.text === 'string') return fo.text;
                }
              }
              if (typeof c.text === 'string') return c.text;
            }
          }
        }

        // Caso: `output` array with `content` entries (some providers)
        if (typeof data === 'object' && data !== null) {
          const dobj = data as Record<string, unknown>;
          const output = dobj.output;
          if (Array.isArray(output) && output.length > 0) {
            const o0 = output[0] as Record<string, unknown>;
            const content = o0.content;
            if (Array.isArray(content) && content.length > 0) {
              return content.map((p) => {
                if (typeof p === 'string') return p;
                if (typeof p === 'object' && p !== null) {
                  const po = p as Record<string, unknown>;
                  return (typeof po.text === 'string' ? po.text : JSON.stringify(po));
                }
                return String(p);
              }).join('\n');
            }
          }
        }

        // Fallbacks:
        if (typeof data === 'string') return data;
        if (typeof data === 'object' && data !== null) {
          const d = data as Record<string, unknown>;
          if (typeof d.message === 'string') return d.message;
        }
        return null;
      } catch {
        console.warn('extractText error');
        return null;
      }
    };

  const aiResults: Array<{ input: string; outputRaw: unknown; outputText: string | null; ok: boolean; status?: number }> = [];

    // Helper to call provider with retries and exponential backoff
    const callProviderWithRetries = async (prompt: string) => {
      const MAX_RETRIES = 3;
      let attempt = 0;
  let lastParsed: unknown = null;
      let lastStatus = 0;

      while (attempt < MAX_RETRIES) {
        attempt++;
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: "system",
                content: "Eres un asistente financiero inteligente que analiza presupuestos, gastos e ingresos y ofrece consejos claros y útiles para mejorar las finanzas personales para estudiantes."
              },
              { role: "user", content: prompt }
            ],
          }),
        });

  let parsed: unknown = null;
  try { parsed = await res.json(); } catch { parsed = null; }
        lastParsed = parsed;
        lastStatus = res.status;

        // Debug logging
        try {
          console.log('[AI] provider response status=', res.status, 'for input truncated:', prompt?.slice?.(0,100));
          console.log('[AI] provider parsed (truncated):', JSON.stringify(parsed)?.slice(0,2000));
        } catch {}

        const text = extractText(parsed) || null;

        // If success (200..299) and we have text, return result
        if (res.ok && text) {
          return { parsed, text, status: res.status };
        }

        // Check provider-level error code inside parsed
        const getProviderErrorCode = (p: unknown): number | null => {
          if (!p || typeof p !== 'object') return null;
          const o = p as Record<string, unknown>;
          const err = o['error'];
          if (!err || typeof err !== 'object') return null;
          const code = (err as Record<string, unknown>)['code'];
          if (typeof code === 'number') return code;
          if (typeof code === 'string') {
            const n = parseInt(code);
            return isNaN(n) ? null : n;
          }
          return null;
        };
        const providerCode = getProviderErrorCode(parsed);

        // If rate-limited (429) or server error (5xx), consider retrying
        const shouldRetry = (res.status === 429 || providerCode === 429) || (res.status >= 500 && res.status < 600);

        if (!shouldRetry) {
          // no retry, return what we have
          return { parsed, text, status: res.status };
        }

        // If we should retry and haven't exhausted attempts, wait with exponential backoff
          if (attempt < MAX_RETRIES) {
          // Prefer Retry-After header if present
          let waitMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
          try {
            const ra = res.headers?.get ? res.headers.get('Retry-After') : null;
            if (ra) {
              const raSec = parseInt(ra);
              if (!isNaN(raSec)) waitMs = Math.max(waitMs, raSec * 1000);
            }
          } catch {}
          await new Promise((r) => setTimeout(r, waitMs));
          continue; // retry
        }

        // exhausted retries
        return { parsed: lastParsed, text: null, status: lastStatus };
      }

      // fallback
      return { parsed: lastParsed, text: null, status: lastStatus };
    };

    for (const m of messages) {
      const r = await callProviderWithRetries(m);
      aiResults.push({ input: m, outputRaw: r.parsed, outputText: r.text, ok: !!r.text, status: r.status });
    }

    // Si alguna de las consultas no devolvió texto útil, no cobramos y devolvemos error al cliente
  const failed = aiResults.filter(r => !r.ok);
    if (failed.length > 0) {
      console.error("AI provider returned incomplete results", failed.map(f => ({ status: f.status, input: f.input })));
      // adicional logging para diagnostico
      try {
        console.log('[AI] aiResults (truncated):', JSON.stringify(aiResults)?.slice(0,2000));
      } catch {}

      // Si el proveedor retornó 429 persistentemente, devolver 429 al cliente con mensaje amigable.
      const any429 = failed.some(f => f.status === 429);
      if (any429) {
        // Intentar extraer Retry-After desde outputRaw
        let retryAfterSec: number | null = null;
        const getRetryAfterSecFromRaw = (raw: unknown): number | null => {
          if (!raw || typeof raw !== 'object') return null;
          const o = raw as Record<string, unknown>;

          const tryHeaders = (hdrs: unknown): number | null => {
            if (!hdrs || typeof hdrs !== 'object') return null;
            const h = hdrs as Record<string, unknown>;
            const v = h['retry-after'] ?? h['Retry-After'];
            if (v === undefined || v === null) return null;
            const n = parseInt(String(v));
            return isNaN(n) ? null : n;
          };

          // top-level headers
          const top = tryHeaders(o['headers']);
          if (top) return top;

          // maybe wrapped in response.headers
          const resp = o['response'];
          if (resp && typeof resp === 'object') {
            const maybe = tryHeaders((resp as Record<string, unknown>)['headers']);
            if (maybe) return maybe;
          }

          return null;
        };

        const getMetadataRaw = (raw: unknown): unknown | null => {
          if (!raw || typeof raw !== 'object') return null;
          const o = raw as Record<string, unknown>;
          const err = o['error'];
          if (err && typeof err === 'object') {
            const meta = (err as Record<string, unknown>)['metadata'];
            if (meta && typeof meta === 'object') {
              const r = (meta as Record<string, unknown>)['raw'];
              if (r !== undefined) return r;
            }
          }
          const meta2 = o['metadata'];
          if (meta2 && typeof meta2 === 'object') {
            const r2 = (meta2 as Record<string, unknown>)['raw'];
            if (r2 !== undefined) return r2;
          }
          return null;
        };

        try {
          for (const f of failed) {
            const raw = f.outputRaw;
            const ra = getRetryAfterSecFromRaw(raw);
            if (ra) { retryAfterSec = ra; break; }

            const metadataRaw = getMetadataRaw(raw);
            if (typeof metadataRaw === 'string' && /rate-limited|Retry-After/i.test(metadataRaw)) {
              // no podemos parsear un número, dejamos null
            }
          }
        } catch {}

        const headers: Record<string,string> = {};
        if (retryAfterSec) headers['Retry-After'] = String(retryAfterSec);

        // Try to return a cached previous successful response for the same input(s)
        try {
          for (const f of failed) {
            try {
              const cached = await prisma.aiUsage.findFirst({
                where: {
                  userId,
                  inputJson: { path: ["userMessage"], equals: f.input },
                },
                orderBy: { createdAt: "desc" },
              });
              if (cached && cached.outputJson && (cached.outputJson as any).message) {
                const cachedMessage = (cached.outputJson as any).message as string;
                console.log('[AI] returning cached response for user', userId, 'input', f.input?.slice?.(0,80));
                return NextResponse.json({ response: cachedMessage, _notice: 'cached' }, { status: 200 });
              }
            } catch (e) {
              /* ignore cache lookup errors */
            }
          }
        } catch (e) {
          /* ignore */
        }

        // Incluir detalle del proveedor (no incluir claves) para facilitar debugging en frontend
        const providerDetails = failed.map(f => ({ status: f.status, input: f.input }));
        // Devuelve un fallback 200 para que el frontend muestre un mensaje en la conversación
        return NextResponse.json({ response: "No he podido obtener respuesta del servicio de IA en este momento. Intenta de nuevo en unos segundos.", provider: providerDetails, _notice: "rate_limited" }, { status: 200, headers });
      }

      // Si no fue un 429, devolver 502 con detalle del proveedor
      // Try cached
      try {
        for (const f of failed) {
          try {
            const cached = await prisma.aiUsage.findFirst({
              where: {
                userId,
                inputJson: { path: ["userMessage"], equals: f.input },
              },
              orderBy: { createdAt: "desc" },
            });
            if (cached && cached.outputJson && (cached.outputJson as any).message) {
              const cachedMessage = (cached.outputJson as any).message as string;
              console.log('[AI] returning cached response for user', userId, 'input', f.input?.slice?.(0,80));
              return NextResponse.json({ response: cachedMessage, _notice: 'cached' }, { status: 200 });
            }
          } catch (e) {
            /* ignore cache lookup errors */
          }
        }
      } catch (e) {
        /* ignore */
      }

      const providerDetails = failed.map(f => ({ status: f.status, input: f.input }));
      // Devuelve fallback 200 para no romper la UI; incluye detalles para el dev.
      return NextResponse.json({ response: "El servicio de IA no devolvió respuesta válida. Intenta nuevamente en unos segundos.", provider: providerDetails, _notice: "provider_error" }, { status: 200 });
    }

    // Guardar todas las entradas en una transacción atómica: múltiples AiUsage, una AiCreditsTransaction y actualizar saldo del usuario.
    try {
      await prisma.$transaction(async (tx: Tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuario no encontrado");
        if (user.aiCreditsRemaining < creditsToCharge) {
          throw new Error("No tienes créditos de IA suficientes");
        }

        // Crear usos individuales
        for (let i = 0; i < aiResults.length; i++) {
          const r = aiResults[i];
            await tx.aiUsage.create({
            data: {
              userId,
              provider: "openrouter",
              requestType,
              model: modelName,
              tokensIn: 0,
              tokensOut: 0,
              tokensTotal: 0,
              creditsCharged: 1,
                inputJson: { userMessage: r.input, ...(idempoKey ? { idempotencyKey: idempoKey } : {}) },
                // Serialize outputRaw to a JSON-safe value to avoid importing generated Prisma types
                outputJson: { message: r.outputText, raw: JSON.parse(JSON.stringify(r.outputRaw)) },
            },
          });
        }

        const balanceAfter = user.aiCreditsRemaining - creditsToCharge;
        await tx.aiCreditsTransaction.create({
          data: {
            userId: user.id,
            change: -creditsToCharge,
            balanceAfter,
            reason: creditsToCharge > 1 ? "ai_request_batch" : "ai_request",
            source: "openrouter",
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            aiCreditsRemaining: { decrement: creditsToCharge },
            aiTotalConsumed: { increment: BigInt(creditsToCharge) },
          },
        });
      });

      // Debug: log success
  try { console.log('[AI] success aiResults (truncated):', JSON.stringify(aiResults)?.slice(0,2000)); } catch {}
      // Devolver respuestas: si fue una sola consulta, devolver string; si múltiples, array
      if (aiResults.length === 1) {
        return NextResponse.json({ response: aiResults[0].outputText });
      }
      return NextResponse.json({ response: aiResults.map(r => r.outputText) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("No tienes créditos")) {
        return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error en /api/ai/request:", error);
    return NextResponse.json({ error: "Error interno en la IA" }, { status: 500 });
  }
}
