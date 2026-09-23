/**
 * Gera todas as imagens do site a partir de "../072 - ON TOP BUSSINESS/Recursos Site",
 * em src/assets/img, com várias larguras pra srcset. Grava src/assets/img/manifesto.json
 * com largura e altura de cada arquivo (pro width/height do <img>, sem salto de layout).
 * Base do 073.
 *
 * - Hero: AVIF e WebP (desktop 960/1280/1672, celular 480/720/800/941).
 * - Imóvel (A garantia na prática) e gráfico dourado (CTA final, com transparência).
 * - Foto do Yoshida: cortada em 1100 px de altura, abaixo da cintura, o que tira a
 *   estrelinha do Gemini do canto inferior direito (y 1115 a 1160).
 * - Logo horizontal (header e rodapé, como no mockup): o PNG oficial é empilhado, com
 *   um vão limpo entre o símbolo (linhas 11 a 703) e o nome (734 a 1012). Os dois
 *   saem do próprio arquivo e são postos lado a lado. Nada é redesenhado.
 * - Favicons (o ícone OT) e imagem de compartilhamento 1200x630.
 *
 * Uso: node scripts/processar-imagens.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const R = '../072 - ON TOP BUSSINESS/Recursos Site'
const OUT = 'src/assets/img'
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const manifesto = {}

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}

// uma imagem (arquivo ou buffer) em várias larguras
async function variantes(origem, nome, larguras, { formatos = ['webp'], q = 74, alfa = false } = {}) {
  for (const w of larguras) {
    for (const f of formatos) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true })
      p = f === 'avif' ? p.avif({ quality: q - 22, effort: 6 }) : p.webp({ quality: q, effort: 6, ...(alfa ? { alphaQuality: 88 } : {}) })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

// ---------------------------------------------------------------- hero
await variantes(`${R}/DESKTOP/IMAGEM HERO DESKTOP.png`, 'hero-desktop', [960, 1280, 1672], { formatos: ['avif', 'webp'], q: 72 })
await variantes(`${R}/MOBILE/IMAGEM HERO MOBILE.png`, 'hero-celular', [480, 720, 800, 941], { formatos: ['avif', 'webp'], q: 72 })

// ---------------------------------------------------------------- imóvel e gráfico
await variantes(`${R}/04 - IMÓVEL.png`, 'imovel', [480, 720, 960, 1280, 1672], { q: 76 })
await variantes(`${R}/05 - GRÁFICO.png`, 'grafico', [900, 1400, 2167], { q: 80, alfa: true })

// ---------------------------------------------------------------- Yoshida (sem a marca do Gemini)
const yoshida = await sharp(`${R}/03 - Yoshida - Proprietário - Sobre.jpg`).extract({ left: 0, top: 0, width: 896, height: 1100 }).toBuffer()
await variantes(yoshida, 'yoshida', [460, 700, 896], { q: 80 })

// ---------------------------------------------------------------- logo
const logoArq = `${R}/01 - LOGO PNG.png`
const meta = await sharp(logoArq).metadata()
const CORTE = 718 // meio do vão entre o símbolo e o nome
// o sharp faz o trim antes do extract na mesma cadeia: corta primeiro, apara depois
const fatia = async (top, height) => sharp(await sharp(logoArq).extract({ left: 0, top, width: meta.width, height }).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
const simbolo = await fatia(0, CORTE)
const nome = await fatia(CORTE, meta.height - CORTE)
const empilhado = await sharp(logoArq).trim({ threshold: 1 }).png().toBuffer()

// horizontal: símbolo 1,55x a altura do bloco do nome (proporção do header do mockup), vão de 15% do símbolo
const alturaNome = nome.info.height
const simb = await sharp(simbolo.data).resize({ height: Math.round(alturaNome * 1.55) }).png().toBuffer({ resolveWithObject: true })
const vao = Math.round(simb.info.height * 0.15)
const altura = Math.max(simb.info.height, alturaNome)
const horizontal = await sharp({
  create: { width: simb.info.width + vao + nome.info.width, height: altura, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: simb.data, left: 0, top: Math.round((altura - simb.info.height) / 2) },
    { input: nome.data, left: simb.info.width + vao, top: Math.round((altura - alturaNome) / 2) },
  ])
  .png()
  .toBuffer()
// header: ~62 px de altura no desktop e ~44 no celular; 2x e 3x pedem ~600 a 900 px de largura
for (const w of [300, 420, 600, 900]) await gravar(sharp(horizontal).resize({ width: w }).webp({ quality: 88, alphaQuality: 92, effort: 6 }), `logo-horizontal-${w}.webp`)
await gravar(sharp(empilhado).resize({ width: 600 }).png({ compressionLevel: 9 }), 'logo-empilhado-600.png')

// ---------------------------------------------------------------- favicons (o ícone OT)
const icone = await sharp(`${R}/02- LOGO - SÓ ICONE - FAVICON.png`).trim({ threshold: 1 }).png().toBuffer()
const quadrado = async (lado, fundo, margem) => {
  const util = Math.round(lado * (1 - margem * 2))
  const ic = await sharp(icone).resize({ width: util, height: util, fit: 'inside' }).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } }).composite([{ input: ic, gravity: 'center' }])
}
const tinta = { r: 17, g: 20, b: 24, alpha: 1 }
mkdirSync('src/raiz', { recursive: true })
await (await quadrado(32, tinta, 0.06)).png().toFile('src/raiz/favicon-32.png')
await (await quadrado(180, tinta, 0.16)).png().toFile('src/raiz/apple-touch-icon.png')
await (await quadrado(192, tinta, 0.16)).png().toFile('src/raiz/icon-192.png')
await (await quadrado(512, tinta, 0.16)).png().toFile('src/raiz/icon-512.png')
// favicon.ico com o PNG de 32 embutido (formato ICO aceita PNG desde o Vista)
const png32 = await (await quadrado(32, tinta, 0.06)).png().toBuffer()
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18)
writeFileSync('src/raiz/favicon.ico', Buffer.concat([ico, png32]))

// ---------------------------------------------------------------- compartilhamento (1200x630): hero com o logo à esquerda
const logoOg = await sharp(empilhado).resize({ width: 330 }).png().toBuffer({ resolveWithObject: true })
const veu = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#111418" stop-opacity=".96"/><stop offset=".42" stop-color="#111418" stop-opacity=".84"/><stop offset=".64" stop-color="#111418" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`,
)
await gravar(
  sharp(`${R}/DESKTOP/IMAGEM HERO DESKTOP.png`)
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'right' })
    .composite([{ input: veu }, { input: logoOg.data, left: 90, top: Math.round((630 - logoOg.info.height) / 2) }])
    .jpeg({ quality: 82, mozjpeg: true }),
  'og-on-top-business.jpg',
)

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
const total = Object.values(manifesto).reduce((s, m) => s + m.kb, 0)
console.log(`${Object.keys(manifesto).length} arquivos em ${OUT} (${total} KB no total), manifesto.json gravado`)
console.log(`logo: símbolo ${simbolo.info.width}x${simbolo.info.height} · nome ${nome.info.width}x${nome.info.height} · horizontal ${simb.info.width + vao + nome.info.width}x${altura}`)
console.log('favicons em src/raiz:', readdirSync('src/raiz').join(', '))
