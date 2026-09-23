// On Top Business: comportamento comum a todas as seções (base do 073). Sem
// biblioteca e sem ouvir o scroll: o que depende de rolagem vai por IntersectionObserver.
// Cada seção com comportamento próprio tem o seu arquivo (mesmo nome do parcial).
;(() => {
  // ---------------------------------------------------------------- revelação no scroll
  const revelar = document.querySelectorAll('[data-revela]')
  if (!('IntersectionObserver' in window)) {
    revelar.forEach((el) => el.classList.add('visivel'))
  } else {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.classList.add('visivel')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    revelar.forEach((el) => io.observe(el))
  }

  // ---------------------------------------------------------------- rastreio dos cliques
  // Dois eventos (copy, bloco 14): WhatsApp de conversa (header, menu, hero, CTA e
  // rodapé) e WhatsApp por tema (cards do modelo e contrato de exemplo). Vão pro
  // dataLayer (GA4 / Tag Manager) e pro Pixel, se um dia forem instalados.
  const EVENTOS = {
    conversa: ['whatsapp_conversa', 'Contact'],
    tema: ['whatsapp_tema', 'Lead'],
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]')
    if (!a) return
    const [evento, pixel] = EVENTOS[a.dataset.evento || 'conversa'] || EVENTOS.conversa
    const origem = a.dataset.zap || a.closest('section, header, footer')?.id || 'pagina'
    ;(window.dataLayer = window.dataLayer || []).push({ event: evento, origem })
    if (pixel && typeof window.fbq === 'function') window.fbq('track', pixel, { origem })
  })
})()
