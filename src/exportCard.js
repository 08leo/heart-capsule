/* 胶囊分享图生成:1080 宽,高度按内容自适应,小红书 3:4 附近 */

function hashNum(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0
  return h
}

function wrapText(ctx, text, maxW) {
  const lines = []
  let line = ''
  for (const ch of String(text)) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

export function downloadCard(cap, hue) {
  const W = 1080
  const PAD = 110
  const maxW = W - PAD * 2

  const probe = document.createElement('canvas').getContext('2d')

  const bodyFont = '30px "Microsoft YaHei", "PingFang SC", sans-serif'
  const echoFont = '28px "Microsoft YaHei", "PingFang SC", sans-serif'
  probe.font = bodyFont
  const textLines = wrapText(probe, cap.text, maxW).slice(0, 10)
  probe.font = echoFont
  const echoLines = wrapText(probe, cap.reply, maxW).slice(0, 12)

  const HEAD = 560 // 顶部:背景氛围 + 胶囊 + 标签 + 日期
  const textH = textLines.length * 48 + 60
  const echoH = echoLines.length * 44 + 60
  const FOOT = 150
  const H = Math.max(1440, HEAD + textH + echoH + FOOT + 120)

  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')

  // 夜空底色
  ctx.fillStyle = '#06080f'
  ctx.fillRect(0, 0, W, H)

  // 极光氛围
  const blob = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(6,8,15,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  blob(190, 170, 520, 'rgba(75,47,158,0.4)')
  blob(930, 480, 480, 'rgba(20,97,92,0.32)')
  blob(540, H - 200, 560, 'rgba(60,40,140,0.18)')

  // 星点
  const seed = hashNum(cap.id)
  for (let i = 0; i < 70; i++) {
    const s = hashNum(cap.id + ':' + i)
    const x = s % W
    const y = ((s >>> 8) % H)
    const r = ((s >>> 16) % 2) + 0.6
    ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + ((s >>> 5) % 30) / 100) + ')'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 发光胶囊
  const cx = W / 2
  const cy = 250
  const r = 96
  ctx.save()
  ctx.shadowColor = 'hsla(' + hue + ',92%,62%,0.55)'
  ctx.shadowBlur = 70
  const og = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
  og.addColorStop(0, 'rgba(255,255,255,0.95)')
  og.addColorStop(0.28, 'hsla(' + hue + ',88%,74%,0.95)')
  og.addColorStop(0.65, 'hsla(' + hue + ',76%,52%,0.95)')
  og.addColorStop(1, 'hsla(' + hue + ',82%,30%,0.98)')
  ctx.fillStyle = og
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.3, cy - r * 0.42, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // 情绪标签
  ctx.textAlign = 'center'
  ctx.font = '26px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'hsla(' + hue + ',85%,78%,1)'
  ctx.fillText(cap.emotion + ' · 强度 ' + cap.intensity, cx, 410)

  // 日期
  const d = new Date(cap.createdAt)
  const dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
  ctx.font = '22px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(153,160,194,0.9)'
  ctx.fillText(dateStr, cx, 452)

  // 正文
  let y = HEAD
  const left = (label) => {
    ctx.textAlign = 'left'
    ctx.font = '20px "Microsoft YaHei", sans-serif'
    ctx.fillStyle = 'rgba(93,100,136,0.95)'
    ctx.fillText(label, PAD, y)
    y += 26
    // 细线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
    y += 34
  }

  left('当 时 你 写 下')
  ctx.font = bodyFont
  ctx.fillStyle = '#eaecf8'
  for (const ln of textLines) {
    ctx.fillText(ln, PAD, y)
    y += 48
  }
  y += 50

  left('回 响')
  ctx.font = echoFont
  ctx.fillStyle = '#c9cff0'
  for (const ln of echoLines) {
    ctx.fillText(ln, PAD, y)
    y += 44
  }

  // 页脚
  ctx.textAlign = 'center'
  ctx.font = '24px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(153,160,194,0.8)'
  ctx.fillText('心 事 胶 囊 ·  把 心 事 ,  封 进 一 颗 星', cx, H - 70)

  const a = document.createElement('a')
  a.download = '心事胶囊-' + dateStr + '.png'
  a.href = cv.toDataURL('image/png')
  a.click()
}
