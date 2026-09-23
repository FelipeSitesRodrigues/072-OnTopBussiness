/**
 * Recorta os mockups aprovados (Recursos Site) por seção, na largura do print:
 * referencias/desktop/<secao>.png em 1440 e referencias/mobile/<secao>.png em 390.
 * É o que o scripts/revisar.mjs põe ao lado do print do site (base do 073).
 * Os limites vêm da troca de fundo claro/escuro medida nos próprios mockups.
 * "Como funciona" e "Antes de investir" não existem no mockup (vêm da copy):
 * não têm recorte, a revisão delas é só de estilo.
 *
 * Uso: node scripts/recortar-mockup.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const R = '../072 - ON TOP BUSSINESS/Recursos Site'
const D = `${R}/DESKTOP/MOCKUP REFERÊNCIA DESKTOP.png`
const M = `${R}/MOBILE/MOCKUP REFERÊNCIA MOBILE.png`
mkdirSync('referencias/desktop', { recursive: true })
mkdirSync('referencias/mobile', { recursive: true })

// mockup desktop: 858 px de largura
const desktop = {
  '01-hero': [0, 472],
  '02-modelo': [472, 709],
  '03-garantia': [709, 978],
  '04-quem-somos': [978, 1258],
  '06-diferenciais': [1258, 1470],
  '08-cta': [1470, 1626],
  '09-rodape': [1626, 1834],
  'pagina-inteira': [0, 1834],
}
for (const [nome, [t, b]] of Object.entries(desktop))
  await sharp(D).extract({ left: 0, top: t, width: 858, height: b - t }).resize({ width: 1440, kernel: 'lanczos3' }).toFile(`referencias/desktop/${nome}.png`)

// três telas de celular lado a lado; x da tela de cada coluna
const col = { 1: [18, 232], 2: [256, 470], 3: [494, 709] }
const mobile = {
  '01-hero': [1, 40, 996],
  '02-modelo': [1, 996, 1604],
  '03-garantia': [1, 1604, 2136],
  '04-quem-somos': [2, 40, 1063],
  '06-diferenciais': [3, 40, 757],
  '08-cta': [3, 757, 1242],
  '09-rodape': [3, 1242, 2046],
}
for (const [nome, [c, t, b]] of Object.entries(mobile)) {
  const [l, r] = col[c]
  await sharp(M).extract({ left: l, top: t, width: r - l, height: b - t }).resize({ width: 390, kernel: 'lanczos3' }).toFile(`referencias/mobile/${nome}.png`)
}
console.log('ok referencias/desktop e referencias/mobile')
