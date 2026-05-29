import mermaid from 'mermaid'
import uiThemes from 'browser/lib/ui-themes'

const darkThemeStyling = `
.loopText tspan {
  fill: white;
}`

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function getId() {
  const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'm-'
  for (let i = 0; i < 7; i++) {
    id += pool[getRandomInt(0, 16)]
  }
  return id
}

async function render(element, content, theme, enableHTMLLabel) {
  try {
    const height = element.attributes.getNamedItem('data-height')
    const isPredefined = height && height.value !== 'undefined'

    if (isPredefined) {
      element.style.height = height.value + 'vh'
    }

    const isDarkTheme = uiThemes.some(
      item => item.name === theme && item.isDark
    )

    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkTheme ? 'dark' : 'default',
      themeCSS: isDarkTheme ? darkThemeStyling : '',
      flowchart: {
        htmlLabels: enableHTMLLabel
      },
      gantt: {
        useWidth: element.clientWidth
      }
    })

    const { svg, bindFunctions } = await mermaid.render(getId(), content)
    element.innerHTML = svg
    if (bindFunctions) bindFunctions(element)

    if (!isPredefined) {
      const el = element.firstChild
      const viewBoxAttr = el && el.getAttribute && el.getAttribute('viewBox')
      if (!viewBoxAttr) return

      const viewBox = viewBoxAttr.split(' ')
      const vbW = parseFloat(viewBox[2])
      const vbH = parseFloat(viewBox[3])
      if (!isFinite(vbW) || !isFinite(vbH) || vbW <= 0 || vbH <= 0) return

      let ratio = vbW / vbH

      if (el.style.maxWidth) {
        const maxWidth = parseFloat(el.style.maxWidth)
        if (isFinite(maxWidth) && maxWidth > 0) {
          ratio *= el.parentNode.clientWidth / maxWidth
        }
      }

      if (!isFinite(ratio) || ratio <= 0) return
      const h = el.parentNode.clientWidth / ratio
      if (!isFinite(h) || h <= 0) return

      el.setAttribute('ratio', ratio)
      el.setAttribute('height', h)
    }
  } catch (e) {
    element.className = 'mermaid-error'
    element.innerHTML = 'mermaid diagram parse error: ' + e.message
  }
}

export default render
