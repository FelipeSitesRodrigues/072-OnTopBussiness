/**
 * Build do site da On Top Business. HTML, CSS e JS estático em dist/ (base do 073).
 *
 *   node build.mjs                            página inteira em dist/index.html
 *   node build.mjs --preview 03-garantia      só aquela seção, em dist/preview/03-garantia.html
 *   node build.mjs --preview 00-header,01-hero
 *   node build.mjs --publicar                 página inteira e apaga dist/preview (antes do commit)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 *   Trecho entre <!-- @head --> e <!-- /@head --> num parcial sobe pro <head>.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o arquivo de cada seção,
 *   com o mesmo nome do parcial, em ordem de nome. Entra minificado num <style>.
 * - JS: mesma regra, em src/js, num <script> no fim do <body>. Cada arquivo é um IIFE.
 * - {{wa:chave}} vira o link do WhatsApp com a mensagem mensagens.chave do config.
 *   {{cfg.caminho}} puxa qualquer valor do config. {{ano}} é o ano atual.
 *   {{descricao}} é a meta description (com a cidade, quando o config tiver).
 * - <!-- @se cfg.caminho --> ... <!-- /@se --> só fica se o valor do config existir.
 *   É assim que as respostas que a On Top ainda vai mandar (CVM, valor mínimo, prazo)
 *   entram sozinhas nas Dúvidas quando o site.config.json for preenchido.
 * - <i data-i="nome" data-w="light" class="..."></i> vira o SVG do Phosphor embutido.
 * - <img data-img="nome" sizes="..." alt="..."> ganha src, srcset, width e height a
 *   partir de src/assets/img/manifesto.json. data-img-max="640" limita o src.
 * - <!-- @schema --> recebe o JSON-LD da empresa, montado do config.
 * - src/paginas/politica.html vira dist/politica-de-privacidade.html (mesmas fontes e base).
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem
 *   destino, marcador {{...}} que sobrou, CSS com chave desbalanceada e o que ainda
 *   falta a On Top mandar.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []
const HEADER = '00-header'
const RODAPE = '09-rodape'

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n')
}

function valor(caminho, avisar = true) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined && avisar) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// sem número no config, o link abre o WhatsApp pra escolher o contato (serve pra revisar)
const wa = (msg) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`
function linkWa(chave) {
  const msg = cfg.mensagens[chave]
  if (!msg) avisos.push(`mensagem de WhatsApp sem chave no config: ${chave}`)
  return wa(msg || '')
}

const cacheIcone = new Map()
function icone(nome, peso = 'light', classe = '') {
  const arq = P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
  if (!cacheIcone.has(arq)) {
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const svg = readFileSync(arq, 'utf8')
    cacheIcone.set(arq, svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''))
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${cacheIcone.get(arq)}</svg>`
}

// <img data-img="nome"> → src, srcset, width, height a partir do manifesto
function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    const attrs = antes + depois
    const maxM = attrs.match(/\sdata-img-max="(\d+)"/)
    const vars = Object.entries(manifesto)
      .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.webp$`)) || [])[1]) }))
      .filter((v) => v.w)
      .sort((a, b) => a.w - b.w)
    if (!vars.length) {
      avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
      return tag
    }
    const max = maxM ? Number(maxM[1]) : Infinity
    const principal = [...vars].reverse().find((v) => v.w <= max) || vars[0]
    const srcset = vars.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
    const limpo = attrs.replace(/\sdata-img-max="\d+"/, '')
    return `<img src="/assets/img/${principal.arq}" srcset="${srcset}" width="${principal.m.w}" height="${principal.m.h}"${limpo}>`
  })
}

function descricao() {
  return cfg.cidade
    ? `Investimento na bolsa com imóvel como garantia de cada operação, em contrato. On Top Business, em ${cfg.cidade}. Entenda como funciona e fale no WhatsApp.`
    : 'Investimento na bolsa com imóvel como garantia de cada operação, em contrato. Entenda como funciona e fale com a On Top Business no WhatsApp.'
}

function schema() {
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: cfg.nome,
    slogan: 'Estratégia na bolsa. Garantia em imóvel.',
    description: 'Investimento na bolsa de valores com um imóvel como garantia de cada operação, descrito em contrato.',
  }
  if (cfg.whatsapp) dados.telephone = `+${cfg.whatsapp}`
  if (cfg.email) dados.email = cfg.email
  if (cfg.endereco) dados.address = { '@type': 'PostalAddress', streetAddress: cfg.endereco, addressCountry: 'BR' }
  if (cfg.cidade) dados.areaServed = { '@type': 'City', name: cfg.cidade }
  if (cfg.razaoSocial) dados.legalName = cfg.razaoSocial
  if (cfg.cnpj) dados.taxID = cfg.cnpj
  if (cfg.instagram) dados.sameAs = [cfg.instagram]
  if (base) Object.assign(dados, { '@id': `${base}/#empresa`, url: `${base}/`, image: `${base}/assets/img/og-on-top-business.jpg`, logo: `${base}/assets/img/logo-empilhado-600.png` })
  return `<script type="application/ld+json">${JSON.stringify(dados)}</script>`
}

// marcadores comuns à home e à política
function marcadores(html) {
  html = html.replace(/<!--\s*@se\s+cfg\.([\w.]+)\s*-->([\s\S]*?)<!--\s*\/@se\s*-->/g, (_, c, dentro) => (valor(c, false) ? dentro : ''))
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{wa:([\w-]+)\}\}/g, (_, chave) => linkWa(chave))
  html = html.replace(/\{\{descricao\}\}/g, () => esc(descricao()))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = imagens(html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-on-top-business.jpg">` : '<meta property="og:image" content="/assets/img/og-on-top-business.jpg">',
  )
  return html
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes(HEADER) ? `<!-- @parcial ${HEADER} -->` : ''
    const rodape = parciais.includes(RODAPE) ? `<!-- @parcial ${RODAPE} -->` : ''
    const meio = parciais
      .filter((n) => n !== HEADER && n !== RODAPE)
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(new RegExp(`<!--\\s*@parcial ${HEADER}\\s*-->[\\s\\S]*<!--\\s*@parcial ${RODAPE}\\s*-->`), `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`)
  }
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @head-parciais -->', cabeca.join('\n  '))
  // o JS entra antes dos marcadores, pra ele também poder usar {{cfg.caminho}}
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js', parciais))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css', parciais))}</style>`)
  html = html.replace('<!-- @schema -->', schema())
  return marcadores(html)
}

function montarPolitica() {
  let html = readFileSync(P('src/paginas/politica.html'), 'utf8')
  const css = arquivos('src/css', '.css')
    .filter((f) => f.startsWith('_'))
    .map((f) => readFileSync(P('src/css', f), 'utf8'))
    .join('\n')
  html = html.replace('<!-- @css -->', () => `<style>${minCss(css + '\n' + readFileSync(P('src/paginas/politica.css'), 'utf8'))}</style>`)
  return marcadores(html)
}

function verificar(html, rotulo, pagina = true) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`[${rotulo}] marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  const pendente = texto.match(/\[(CONFIRMAR|INSERIR|COMPLETAR)[^\]]*\]/g)
  if (pendente) avisos.push(`[${rotulo}] marcação de pendência da copy no texto: ${pendente.slice(0, 3).join(' | ')}`)
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '?'
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  if (pagina) {
    $('a[href^="#"]').each((_, el) => {
      const alvo = $(el).attr('href').slice(1)
      if (alvo && !ids[alvo]) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
    })
    if ($('h1').length !== 1) avisos.push(`[${rotulo}] ${$('h1').length} h1 na página (precisa ser 1)`)
  }
}

// o que a On Top ainda precisa mandar (copy, bloco 14)
function pendencias() {
  const falta = []
  if (!cfg.whatsapp) falta.push('WhatsApp (os links abrem o WhatsApp sem destinatário e o número aparece como (00) 00000-0000)')
  if (!cfg.cidade) falta.push('cidade (eyebrow do hero e meta description)')
  if (!cfg.cnpj) falta.push('CNPJ e razão social (rodapé)')
  if (!cfg.email) falta.push('e-mail')
  if (!cfg.endereco) falta.push('endereço e horário')
  if (!cfg.registroCvm) falta.push('registro na CVM ou instituição autorizada (sem isso, não publicar nem anunciar: copy, bloco 14)')
  const r = cfg.respostas || {}
  const semResposta = Object.entries(r).filter(([, v]) => !v).map(([k]) => k)
  if (semResposta.length) falta.push(`respostas das Dúvidas ainda escondidas: ${semResposta.join(', ')}`)
  if (!cfg.dominio) falta.push('domínio: sem canonical, sem sitemap e og:image relativo')
  return falta
}

// ---------------------------------------------------------------- execução
// No --publicar, dist sai do zero: a cópia só acrescenta, então imagem que saiu
// de src/assets ficaria esquecida em dist e iria pro GitHub. Fora dele não
// apaga nada, porque vários builds de preview podem rodar ao mesmo tempo.
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
if (!argPreview) {
  const html = montar(null)
  verificar(html, 'página')
  gravar(path.join(DIST, 'index.html'), html)
  if (existsSync(P('src/paginas/politica.html'))) {
    const politica = montarPolitica()
    verificar(politica, 'política', false)
    gravar(path.join(DIST, 'politica-de-privacidade.html'), politica)
  }
  const base = (cfg.dominio || '').replace(/\/$/, '')
  gravar(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`)
  if (base) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
  gravar(
    path.join(DIST, 'site.webmanifest'),
    JSON.stringify({ name: cfg.nome, short_name: 'On Top', start_url: '/', display: 'standalone', background_color: '#111418', theme_color: '#111418', icons: [192, 512].map((s) => ({ src: `/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }),
  )
  if (process.argv.includes('--publicar')) rmSync(path.join(DIST, 'preview'), { recursive: true, force: true })
  console.log(`ok dist/index.html ${kb(html)}`)
  const falta = pendencias()
  if (falta.length) console.log(`FALTA A ON TOP MANDAR:\n  ${falta.join('\n  ')}`)
} else {
  const nome = argPreview.join('+')
  const html = montar(argPreview)
  verificar(html, `preview ${nome}`, false)
  gravar(path.join(DIST, `preview/${nome}.html`), html)
  console.log(`ok /preview/${nome}.html ${kb(html)}`)
}
if (avisos.length) console.log(`AVISOS:\n  ${avisos.join('\n  ')}`)
