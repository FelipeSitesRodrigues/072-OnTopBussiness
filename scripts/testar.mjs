/**
 * Teste de cliques e de layout do site, no Chrome da máquina (puppeteer-core).
 * Base do 073, adaptado à On Top Business.
 *
 * - Estouro horizontal em 9 larguras, de 320 a 1920.
 * - Revelação no scroll: rola na roda do mouse, como gente de verdade, e todo
 *   [data-revela] precisa ganhar .visivel (bug do 067: foto que nunca aparecia).
 * - Menu do celular: abre, marca aria-expanded, põe o foco dentro, fecha no
 *   clique do link e no Esc (devolvendo o foco pro botão).
 * - Todo link de WhatsApp: número do config, nova aba, data-zap único e mensagem.
 * - Faixa de pilares no celular: setas trocam o pilar e a bolinha, a seta da
 *   direita no último volta pro primeiro, a troca automática anda sozinha e o
 *   botão de pausa para. No desktop, os 4 pilares à vista, sem setas.
 * - Dúvidas: o acordeão abre uma de cada vez.
 * - Âncoras do menu apontam pra seções que existem. Um h1 só. Erros de console.
 * - Política de privacidade abre em /politica-de-privacidade.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3072'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const NAVEGADOR = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))
  // ERR_ABORTED é o srcset/picture trocando de candidato quando a janela muda, não arquivo faltando
  page.on('requestfailed', (r) => !/wa\.me|instagram|google/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED' && erros.push(`falhou: ${r.url()} (${r.failure()?.errorText})`))

  console.log('\nLarguras (estouro horizontal)')
  for (const w of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: w < 768 ? 800 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    ok(sw <= iw, `${w}px sem rolagem lateral (${sw}/${iw})`)
  }

  console.log('\nRevelação no scroll')
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: w < 768 ? 844 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < altura; y += 120) {
      await page.mouse.wheel({ deltaY: 120 })
      await espera(25)
    }
    await espera(1500)
    const presos = await page.evaluate(() => [...document.querySelectorAll('[data-revela]:not(.visivel)')].filter((e) => e.checkVisibility()).map((e) => `${e.tagName.toLowerCase()}.${e.classList[0] || '?'}`))
    ok(presos.length === 0, `${w}px: todo elemento animado aparece${presos.length ? ` (presos: ${presos.join(', ')})` : ''}`)
  }

  console.log('\nMenu do celular')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const botao = await page.evaluateHandle(() => document.querySelector('header button[aria-expanded]'))
  if (!(await botao.evaluate((b) => !!b))) ok(false, 'botão do menu (header button[aria-expanded]) existe')
  else {
    await botao.click()
    await espera(500)
    let e = await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      const painel = document.getElementById(b.getAttribute('aria-controls'))
      return { aria: b.getAttribute('aria-expanded'), visivel: !!painel && painel.checkVisibility(), focoDentro: !!painel && painel.contains(document.activeElement) }
    })
    ok(e.aria === 'true' && e.visivel, 'abre e marca aria-expanded=true')
    ok(e.focoDentro, 'foco vai pra dentro do menu')
    await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      document.getElementById(b.getAttribute('aria-controls')).querySelector('a[href="#modelo"]').click()
    })
    await espera(1100)
    e = await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      const cab = document.getElementById('cab').getBoundingClientRect().bottom
      return { aria: b.getAttribute('aria-expanded'), y: Math.round(document.getElementById('modelo').getBoundingClientRect().top), cab: Math.round(cab) }
    })
    ok(e.aria === 'false', 'fecha ao tocar num link')
    ok(e.y >= e.cab - 2 && e.y < 160, `rola até O modelo sem ficar escondido sob o header (topo em ${e.y}px, header até ${e.cab}px)`)
    await botao.click()
    await espera(400)
    await page.keyboard.press('Escape')
    await espera(400)
    e = await page.evaluate(() => ({ aria: document.querySelector('header button[aria-expanded]').getAttribute('aria-expanded'), foco: document.activeElement?.matches('header button[aria-expanded]') }))
    ok(e.aria === 'false' && e.foco, 'Esc fecha e devolve o foco pro botão')
  }

  console.log('\nFaixa de pilares no celular (carrossel)')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const ativo = () => page.evaluate(() => [...document.querySelectorAll('.faixa__ponto')].findIndex((p) => p.getAttribute('aria-current') === 'true'))
  const noCentro = () =>
    page.evaluate(() => {
      const t = document.querySelector('[data-trilho]')
      const r = t.getBoundingClientRect()
      const meio = r.left + r.width / 2
      return [...t.children].findIndex((li) => {
        const b = li.getBoundingClientRect()
        return b.left <= meio && b.right >= meio
      })
    })
  await page.evaluate(() => document.querySelector('.faixa').scrollIntoView({ block: 'center', behavior: 'instant' }))
  await espera(300)
  ok((await ativo()) === 0 && (await noCentro()) === 0, 'começa no pilar 1, com a bolinha 1 marcada')
  const pausaVisivel = await page.evaluate(() => !document.querySelector('[data-pausa]').hidden)
  ok(pausaVisivel, 'botão de pausa aparece com movimento liberado')
  await espera(4700)
  ok((await noCentro()) === 1 && (await ativo()) === 1, 'a troca automática passa pro pilar 2 sozinha')
  await page.click('[data-pausa]')
  await espera(300)
  const pausado = await page.evaluate(() => document.querySelector('[data-pausa]').getAttribute('aria-pressed'))
  const antes = await noCentro()
  await espera(4700)
  ok(pausado === 'true' && (await noCentro()) === antes, 'o botão de pausa para a troca automática')
  await page.click('[data-prox]')
  await espera(700)
  ok((await noCentro()) === antes + 1 && (await ativo()) === antes + 1, 'a seta da direita vai pro próximo pilar')
  await page.click('.faixa__ponto:nth-child(4)')
  await espera(700)
  await page.click('[data-prox]')
  await espera(900)
  ok((await noCentro()) === 0 && (await ativo()) === 0, 'no último pilar, a seta da direita volta pro primeiro')
  await page.click('[data-ant]')
  await espera(900)
  ok((await noCentro()) === 3, 'no primeiro pilar, a seta da esquerda vai pro último')

  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const desk = await page.evaluate(() => {
    const t = document.querySelector('[data-trilho]').getBoundingClientRect()
    const itens = [...document.querySelectorAll('.faixa__item')].map((li) => li.getBoundingClientRect())
    return { dentro: itens.every((b) => b.left >= t.left - 1 && b.right <= t.right + 1 && b.width > 0), seta: getComputedStyle(document.querySelector('[data-prox]')).display }
  })
  ok(desk.dentro && desk.seta === 'none', 'no desktop os 4 pilares ficam à vista, sem setas')

  console.log('\nLinks de WhatsApp')
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => ({ href: a.href, origem: a.dataset.zap || '', evento: a.dataset.evento || 'conversa', texto: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim(), alvo: a.target })),
  )
  const origens = links.map((l) => l.origem)
  // header, menu, hero, 3 cards do modelo, contrato de exemplo, CTA e rodapé = 9
  ok(links.length >= 9, `${links.length} links de WhatsApp na página`)
  ok(new Set(origens).size === origens.length && !origens.includes(''), `todo link tem data-zap único${new Set(origens).size !== origens.length ? ': repetidos ' + origens.filter((o, i) => origens.indexOf(o) !== i).join(', ') : ''}`)
  for (const l of links) {
    const u = new URL(l.href)
    const numero = u.pathname.replace(/\//g, '')
    const msg = u.searchParams.get('text') || ''
    ok(numero === cfg.whatsapp && l.alvo === '_blank' && /^Olá! Vim pelo site da On Top Business/.test(msg), `${l.origem.padEnd(24)} [${l.evento}] "${l.texto.slice(0, 30)}" -> ${msg.slice(0, 96)}`)
  }

  console.log('\nDúvidas')
  const faq = await page.evaluate(async () => {
    const itens = [...document.querySelectorAll('#duvidas details')]
    const abertoNoInicio = itens.filter((d) => d.open).length
    itens[1].open = true
    itens[2].open = true
    await new Promise((r) => setTimeout(r, 50))
    return { total: itens.length, abertoNoInicio, abertos: itens.filter((d) => d.open).length }
  })
  ok(faq.abertoNoInicio === 1, 'começa com a primeira dúvida aberta')
  ok(faq.total >= 6 && faq.abertos === 1, `acordeão abre uma de cada vez (${faq.total} dúvidas, ${faq.abertos} aberta)`)

  console.log('\nÂncoras, h1 e imagens')
  const ancoras = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))].filter((h) => h.length > 1).map((h) => [h, !!document.querySelector(h)]))
  for (const [h, existe] of ancoras) ok(existe, `${h} existe`)
  const estrutura = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, semAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length }))
  ok(estrutura.h1 === 1, `um h1 só (${estrutura.h1})`)
  ok(estrutura.semAlt === 0, `toda imagem tem alt (${estrutura.semAlt} sem)`)

  console.log('\nPolítica de privacidade')
  const resp = await page.goto(BASE + '/politica-de-privacidade', { waitUntil: 'networkidle2' })
  const pol = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), voltar: !!document.querySelector('a[href="/"]') }))
  ok(resp.status() === 200 && pol.h1 === 'Política de privacidade' && pol.voltar, `abre com o título e o link de volta (${resp.status()})`)

  console.log('\nConsole')
  ok(erros.length === 0, `sem erros no console${erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0
