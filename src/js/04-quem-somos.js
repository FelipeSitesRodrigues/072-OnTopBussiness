// 04 · Quem somos: a trajetória que acende marco por marco e os números que contam.
// Sem JS ou com "reduzir movimento", nada disso roda e a página já mostra o estado
// final (valores e barras cheias estão no HTML). Tudo dispara por IntersectionObserver.
;(() => {
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const temIO = 'IntersectionObserver' in window

  // ---------------------------------------------------------------- trajetória
  // Desktop: os quatro marcos ganham .ativo juntos e o CSS faz a fila (--atraso).
  // Celular: cada marco acende quando entra na tela, conforme a pessoa rola.
  const traj = document.querySelector('[data-trajetoria]')
  if (traj) {
    const marcos = [...traj.querySelectorAll('.marco')]
    const desktop = window.matchMedia('(min-width: 1024px)')
    const acenderTodos = () => marcos.forEach((m) => m.classList.add('ativo'))
    if (calmo || !temIO) acenderTodos()
    else {
      const io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue
            if (e.target === traj) {
              if (desktop.matches) {
                acenderTodos()
                io.disconnect()
              }
            } else if (!desktop.matches) {
              e.target.classList.add('ativo')
              io.unobserve(e.target)
            }
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.3 },
      )
      io.observe(traj)
      marcos.forEach((m) => io.observe(m))
      // trocou de largura no meio (girou o tablet): não deixa marco apagado pra trás
      desktop.addEventListener('change', () => {
        acenderTodos()
        io.disconnect()
      })
    }
  }

  // ---------------------------------------------------------------- números
  // data-conta = valor final; data-tipo: pct (+426%), vezes (12×) ou nada (25).
  // No card de resultados a barra "depois" sobe junto com o número, na proporção
  // real: +426% é 5,26 vezes o antes, 12× é 12 vezes, 52× é 52 vezes.
  const contadores = document.querySelectorAll('[data-contador]')
  if (calmo || !temIO || !contadores.length) return

  const DURACAO = 2200
  const suave = (t) => 1 - Math.pow(1 - t, 4)
  const texto = (tipo, v) => (tipo === 'pct' ? `+${v}%` : tipo === 'vezes' ? `${v}×` : String(v))
  const inicio = (tipo) => (tipo === 'vezes' ? 1 : 0)
  const tamanho = (tipo, v) => (tipo === 'pct' ? 1 + v / 100 : v)

  contadores.forEach((c) => {
    const n = c.querySelector('[data-conta]')
    if (n) n.querySelector('.conta__valor').textContent = texto(n.dataset.tipo, inicio(n.dataset.tipo))
  })

  const contar = (caixa, espera) => {
    const n = caixa.querySelector('[data-conta]')
    if (!n) return
    const valor = n.querySelector('.conta__valor')
    const barra = caixa.querySelector('.res__barra--depois')
    const tipo = n.dataset.tipo
    const alvo = Number(n.dataset.conta)
    const de = inicio(tipo)
    caixa.classList.add('contando')
    if (barra) barra.style.transform = 'scaleY(0)'
    // no card, a barra do "antes" sobe primeiro (CSS, .45 s); o número sai de lá
    setTimeout(() => {
      const t0 = performance.now()
      const quadro = (agora) => {
        const t = Math.min(1, (agora - t0) / DURACAO)
        const atual = de + (alvo - de) * suave(t)
        valor.textContent = texto(tipo, Math.round(atual))
        if (barra) barra.style.transform = `scaleY(${(tamanho(tipo, atual) / tamanho(tipo, alvo)).toFixed(4)})`
        if (t < 1) requestAnimationFrame(quadro)
      }
      requestAnimationFrame(quadro)
    }, espera + (barra ? 420 : 150))
  }

  const io = new IntersectionObserver(
    (entradas) => {
      // os que entram juntos (os três do card no desktop) saem em fila
      let fila = 0
      for (const e of entradas) {
        if (!e.isIntersecting) continue
        contar(e.target, fila++ * 180)
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.5 },
  )
  contadores.forEach((c) => io.observe(c))
})()
