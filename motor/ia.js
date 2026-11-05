// Inteligencia artificial (Claude): responde dudas y lee comprobantes de pago.
import Anthropic from '@anthropic-ai/sdk';
import { evento } from './store.js';

export const MODELOS = [
  { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5 (el más capaz)' },
  { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5 (rápido y más económico)' },
  { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5 (el más económico)' }
];
const BETA_RESPALDO = 'server-side-fallback-2026-07-01';

async function pedir(bot, parametros) {
  const cliente = new Anthropic({ apiKey: bot.ia.apiKey });
  const modelo = MODELOS.some(m => m.id === bot.ia.modelo) ? bot.ia.modelo : 'claude-opus-5-5';
  try {
    let r;
    if (modelo.startsWith('claude-haiku')) {
      r = await cliente.messages.create({ model: modelo, max_tokens: 16000, ...parametros });
    } else {
      // Si el modelo rechaza la petición, la API la reintenta sola con un modelo de respaldo.
      r = await cliente.beta.messages.create({
        model: modelo, max_tokens: 16000, betas: [BETA_RESPALDO], fallbacks: 'default',
        output_config: { effort: 'low' }, ...parametros
      });
    }
    if (r.stop_reason === 'refusal') return '';
    return r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) evento({ tipo: 'aviso', botId: bot.id, texto: 'La clave de la IA no es válida. Revísala en "Configurar IA".' });
    else if (e instanceof Anthropic.RateLimitError) evento({ tipo: 'aviso', botId: bot.id, texto: 'La IA alcanzó su límite de uso por ahora.' });
    else if (e instanceof Anthropic.APIError) evento({ tipo: 'aviso', botId: bot.id, texto: `La IA respondió con un error (${e.status}).` });
    console.error('[ia]', e.message);
    throw e;
  }
}

const BASE = `Eres el asistente de ventas por WhatsApp de un negocio que vende productos digitales. Respondes las dudas del cliente después de que ya recibió la presentación del producto.

Cómo responder:
- Escribe como en WhatsApp: mensajes cortos, cercanos y claros, en el mismo idioma del cliente. Sin títulos ni listas largas.
- Usa solo la información del negocio que aparece abajo. Si te preguntan algo que no está ahí (precios, cuentas de pago, garantías, fechas), no lo inventes: di que un asesor se lo confirma enseguida.
- Tu objetivo es resolver la duda y ayudar a que el cliente complete su compra, sin presionar.
- Si el cliente dice que ya pagó, pídele que envíe la captura del comprobante por este chat.

Información del negocio:
`;

export async function responder(bot, contacto) {
  const mensajes = [];
  for (const m of contacto.mensajes.slice(-24)) {
    if (m.de === 'sistema') continue;
    const texto = m.texto || (m.tipo !== 'texto' ? `[${m.tipo}]` : '');
    if (!texto) continue;
    mensajes.push({ role: m.de === 'cliente' ? 'user' : 'assistant', content: texto });
  }
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
  if (!mensajes.length) return '';
  return pedir(bot, {
    system: BASE + (bot.ia.instrucciones || '(el dueño aún no escribió información del negocio)'),
    messages: mensajes
  });
}

export async function transcribir(bot, buffer, mime) {
  const tipo = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/jpeg';
  return pedir(bot, {
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: tipo, data: buffer.toString('base64') } },
        { type: 'text', text: 'Transcribe todo el texto visible de esta imagen tal como aparece (montos, nombres, bancos, fechas, códigos de operación). Devuelve solo el texto, sin comentarios. Si no hay texto, responde: SIN TEXTO.' }
      ]
    }]
  });
}
