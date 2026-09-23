// 01 · Faixa de pilares: no celular vira carrossel (prompt técnico, itens 7 e 24).
// Trilho com scroll-snap (o swipe é nativo), setas, bolinhas e troca automática
// a cada 4 s em loop. A troca só roda com a faixa na tela, para no toque, no
// hover e no foco, some com "reduzir movimento" e tem botão de pausa (WCAG 2.2.2).
// A partir de 768 px os 4 pilares ficam em linha e nada disso roda.
;(() => {
  const faixa = document.querySelector('[data-carrossel]')
  if (!faixa) return
  const trilho = faixa.querySelector('[data-trilho]')
  const itens = [...trilho.children]
  const pontos = [...faixa.querySelectorAll('.faixa__ponto')]
  const pausa = faixa.querySelector('[data-pausa]')
  const celular = window.matchMedia('(max-width: 767.98px)')
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)')
  const INTERVALO = 4000

  let atual = 0
  let timer = null
  let naTela = false
  let parado = false // o visitante pausou ou mexeu: não volta a rodar sozinho
  let segurando = false // hover, foco ou dedo na faixa

  const ir = (i, suave = true) => {
    atual = (i + itens.length) % itens.length
    trilho.scrollTo({ left: itens[atual].offsetLeft - trilho.offsetLeft, behavior: suave && !calmo.matches ? 'smooth' : 'auto' })
    marcar(atual)
  }
  const marcar = (i) => pontos.forEach((p, j) => p.setAttribute('aria-current', String(j === i)))

  // bolinha acompanha o item que está no meio do trilho (swipe incluído)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            atual = itens.indexOf(e.target)
            marcar(atual)
          }
        }
      },
      { root: trilho, threshold: [0.6] },
    )
    itens.forEach((it) => io.observe(it))
    new IntersectionObserver(([e]) => {
      naTela = e.isIntersecting
      rodar()
    }).observe(faixa)
  }

  const pode = () => celular.matches && !calmo.matches && !parado && !segurando && naTela && !document.hidden
  function rodar() {
    clearInterval(timer)
    timer = null
    if (pode()) timer = setInterval(() => ir(atual + 1), INTERVALO)
    if (pausa) pausa.hidden = !celular.matches || calmo.matches
  }
  const parar = () => {
    parado = true
    pausa?.setAttribute('aria-pressed', 'true')
    pausa?.setAttribute('aria-label', 'Continuar a troca automática')
    rodar()
  }

  faixa.querySelector('[data-ant]')?.addEventListener('click', () => { parar(); ir(atual - 1) })
  faixa.querySelector('[data-prox]')?.addEventListener('click', () => { parar(); ir(atual + 1) })
  pontos.forEach((p, i) => p.addEventListener('click', () => { parar(); ir(i) }))
  pausa?.addEventListener('click', () => {
    if (parado) {
      parado = false
      pausa.setAttribute('aria-pressed', 'false')
      pausa.setAttribute('aria-label', 'Pausar a troca automática')
      rodar()
    } else parar()
  })

  // dedo no trilho conta como interação: o visitante quer ver no ritmo dele
  trilho.addEventListener('touchstart', parar, { passive: true })
  trilho.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) parar() }, { passive: true })
  faixa.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { segurando = true; rodar() } })
  faixa.addEventListener('pointerleave', () => { segurando = false; rodar() })
  faixa.addEventListener('focusin', () => { segurando = true; rodar() })
  faixa.addEventListener('focusout', () => { segurando = false; rodar() })
  document.addEventListener('visibilitychange', rodar)

  const aoMudar = () => {
    if (!celular.matches) trilho.scrollLeft = 0
    rodar()
  }
  for (const mq of [celular, calmo]) {
    if (mq.addEventListener) mq.addEventListener('change', aoMudar)
    else mq.addListener(aoMudar)
  }
  rodar()
})()
