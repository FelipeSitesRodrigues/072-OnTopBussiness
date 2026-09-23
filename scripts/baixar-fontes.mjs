/**
 * Baixa as fontes do Google Fonts e grava no próprio site (src/assets/fonts),
 * com o @font-face em src/css/_fontes.css (base do 073).
 *
 * O mockup aprovado usa um grotesco condensado e pesado, em caixa alta, nos títulos.
 * A Archivo tem eixo de largura (62 a 125): a versão dos títulos sai da variável,
 * cortada no latin e com os eixos travados (subset-font).
 * - 'Archivo Titulo'  títulos, headline e números grandes
 * - Instrument Sans variável (400 a 700): texto, botões, menu e rótulos
 * - 'Newsreader Italico': só a citação do Quem somos (serifada em itálico do mockup)
 *
 * Uso: node scripts/baixar-fontes.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import subsetFont from 'subset-font'

const TITULO = { wdth: 64, wght: 700 }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
mkdirSync('src/assets/fonts', { recursive: true })
mkdirSync('scripts/.cache', { recursive: true })

async function css(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}
async function baixar(url, nome, pasta = 'src/assets/fonts') {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(`${pasta}/${nome}`, buf)
  console.log('ok', nome, Math.round(buf.length / 1024) + ' KB')
}

const saida = []
const latin = (texto) => [...texto.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].find(([, subset]) => subset === 'latin')[2]

let letras = ''
for (let c = 0x20; c <= 0x7e; c++) letras += String.fromCharCode(c)
for (let c = 0xa0; c <= 0xff; c++) letras += String.fromCharCode(c)
letras += '‘’“”•…€™½·→'

async function fixa(urlCss, cache, familia, arq, eixos, estilo = 'normal') {
  const bloco = latin(await css(urlCss))
  await baixar(bloco.match(/url\(([^)]+)\)/)[1], cache, 'scripts/.cache')
  const buf = await subsetFont(readFileSync(`scripts/.cache/${cache}`), letras, { targetFormat: 'woff2', variationAxes: eixos })
  writeFileSync(`src/assets/fonts/${arq}`, buf)
  console.log('ok', arq, Math.round(buf.length / 1024) + ' KB', JSON.stringify(eixos))
  saida.push(`@font-face {
  font-family: '${familia}';
  font-style: ${estilo};
  font-weight: ${eixos.wght};
  font-display: swap;
  src: url('/assets/fonts/${arq}') format('woff2');
}`)
}

// Archivo condensada dos títulos
await fixa('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap', 'archivo-var.woff2', 'Archivo Titulo', 'archivo-titulo.woff2', TITULO)

// Newsreader itálica da citação
await fixa('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@1,6..72,200..800&display=swap', 'newsreader-italico-var.woff2', 'Newsreader Italico', 'newsreader-italico.woff2', { opsz: 24, wght: 400 }, 'italic')

// Instrument Sans variável (400 a 700), subset latin do próprio Google
const instrument = latin(await css('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap'))
await baixar(instrument.match(/url\(([^)]+)\)/)[1], 'instrument-sans-var.woff2')
saida.push(`@font-face {
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/assets/fonts/instrument-sans-var.woff2') format('woff2');
  unicode-range: ${instrument.match(/unicode-range:\s*([^;]+);/)[1]};
}`)

writeFileSync('src/css/_fontes.css', `/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */\n${saida.join('\n')}\n`)
console.log('src/css/_fontes.css gravado')
