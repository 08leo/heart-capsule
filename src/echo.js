const SYSTEM_PROMPT = `你是「心事胶囊」的回响。用户写下一句心事,你的任务不是安慰,而是回应。

要求:
1. 先接住情绪(一两句),绝不使用"加油""你真棒""会好起来的"这类话。
2. 然后三选一,自然地做其中一件事:给一个重新看这件事的角度;提一个值得认真想的问题;写一句短诗。
3. 全文 60~140 字,语气像一位安静、读过很多书的朋友。不煽情,不说教,不堆形容词。
4. 只返回 JSON,不要任何其他文字或代码块标记:
{"reply":"...","emotion":"喜悦|平静|忧郁|焦虑|思念|迷茫|愤怒","intensity":1到5的整数}`

export const EMOTION_HUES = {
  喜悦: 45,
  平静: 168,
  忧郁: 222,
  焦虑: 22,
  思念: 332,
  迷茫: 268,
  愤怒: 5
}

function shapeOf(intensity) {
  if (intensity <= 2) return 'drop'
  if (intensity >= 4) return 'pill'
  return 'orb'
}

function normalizeEcho(raw) {
  const emotion = EMOTION_HUES[raw.emotion] !== undefined ? raw.emotion : '平静'
  let intensity = Number(raw.intensity)
  if (!Number.isFinite(intensity)) intensity = 3
  intensity = Math.min(5, Math.max(1, Math.round(intensity)))
  return {
    reply: String(raw.reply || '').trim(),
    emotion,
    intensity,
    shape: shapeOf(intensity)
  }
}

function parseEcho(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no json')
  return normalizeEcho(JSON.parse(cleaned.slice(start, end + 1)))
}

export async function requestEcho(text, settings) {
  if (settings.demo || !settings.apiKey || !settings.baseURL) {
    await sleep(1400 + Math.random() * 900)
    return demoEcho(text)
  }
  const base = settings.baseURL.replace(/\/+$/, '')
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + settings.apiKey
    },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.9
    })
  })
  if (!res.ok) {
    throw new Error('AI 接口返回 ' + res.status)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 没有返回内容')
  const echo = parseEcho(content)
  if (!echo.reply) throw new Error('回响为空')
  return echo
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* ---------- 演示模式:未配置 API 时也能完整体验 ---------- */

const DEMO_POOL = [
  {
    keys: ['累', '压力', '撑不住', '忙', '熬夜', '喘不过'],
    emotion: '焦虑',
    intensity: 4,
    replies: [
      '你把"累"说出口的时候,其实已经比硬撑着的人诚实了。疲惫不是软弱,是身体在替你记账。今晚早点睡,事情明天还在,但你歇过了再去看它们,分量会不一样。',
      '人在最累的时候,容易把所有事都看成同一座山。试着把它们摊开:哪几件是必须今晚做的,哪几件只是你放心不下?你扛着的大概是后者的重量。'
    ]
  },
  {
    keys: ['难过', '伤心', '哭', '失恋', '分开', '失去', '痛'],
    emotion: '忧郁',
    intensity: 4,
    replies: [
      '难过不需要被说服消失,它只是在替你说"这对我很重要"。你不用急着好起来,眼泪也是一种整理。风穿过空房间,房间还是房间,你也还是你。',
      '失去的痛,是拥有过的回声。你现在感到疼,恰好说明那段日子是真的。不急着翻篇,先允许自己坐在疼里一会儿,它会慢慢变成别的东西。'
    ]
  },
  {
    keys: ['开心', '高兴', '终于', '成功', '通过', '拿到', '太好了'],
    emotion: '喜悦',
    intensity: 4,
    replies: [
      '替你高兴——不是客套那种,是"你等的这件事真的来了"的那种。开心的时候记得多说几遍,好消息也值得被认真对待。今天的你,是以后想起会笑的那种日子。',
      '恭喜。这种时刻有个秘密:把它具体地记下来——几号、天气、和谁说的第一句。未来的某一天,这颗胶囊会比现在更亮。'
    ]
  },
  {
    keys: ['想', '家', '妈', '爸', '奶奶', '爷爷', '朋友', '她', '他'],
    emotion: '思念',
    intensity: 3,
    replies: [
      '思念是距离在帮你确认什么人重要。你现在想的这个人,大概率也在某个时刻想起你——只是你们的时间没对上而已。要不要今晚就说一句?想念不该只是心事。',
      '想一个人的时候,其实是想回那个有他在的自己。这段距离不是空的,它装着你为什么出发。'
    ]
  },
  {
    keys: ['迷茫', '不知道', '选择', '纠结', '该不该', '怎么办', '未来'],
    emotion: '迷茫',
    intensity: 3,
    replies: [
      '迷茫往往不是因为没有答案,而是因为答案还不肯现身。先别急着选,把两个选项各自"最坏的结果"写下来——人怕的往往不是选错,而是没看清自己输得起什么。',
      '看不清路的时候,不是因为路不存在,而是你正站在雾最浓的地方。往前走十步,雾常常就散了。你不用现在就看清全程,只需要看清下一步。'
    ]
  },
  {
    keys: ['气', '烦', '讨厌', '愤怒', '受不了', '凭什么'],
    emotion: '愤怒',
    intensity: 4,
    replies: [
      '愤怒在说:有什么你在乎的东西被越界了。先别急着压下去,问自己一句——具体是哪条线被碰了?找到它,这次生气就没白生。',
      '生气是正当的,只是别让怒气替你说话。把想砸的东西写下来,明天再读一遍,留下的部分才是你真正要说的。'
    ]
  },
  {
    keys: ['平静', '还行', '一般', '没什么'],
    emotion: '平静',
    intensity: 2,
    replies: [
      '"没什么"的日子里,其实藏着最好的日子——没有风浪的水面,才照得清东西。今天有什么小事让你多停了一秒吗?哪怕只是光线很好。',
      '平静不是空白,是留白。一颗不需要急着重量的心,才有地方装明天。'
    ]
  }
]

const FALLBACK = [
  {
    reply: '你愿意把它写下来,这件事本身就有分量。我认真读了——里面有一种想被理解的语气。能多说一句吗:如果这件事一年后回头看,你觉得它会变成什么样子?',
    emotion: '平静',
    intensity: 2
  },
  {
    reply: '有些心事说不清,是因为它还在成形。不用急着定义它。夜深了,这颗胶囊先替你保管着,等哪天你想明白了,回来打开它对照一下,会很有意思。',
    emotion: '迷茫',
    intensity: 2
  }
]

function demoEcho(text) {
  const pool = DEMO_POOL.filter((g) => g.keys.some((k) => text.includes(k)))
  const group = pool.length ? pool[Math.floor(Math.random() * pool.length)] : FALLBACK[Math.floor(Math.random() * FALLBACK.length)]
  const reply = group.replies ? group.replies[Math.floor(Math.random() * group.replies.length)] : group.reply
  const echo = normalizeEcho({ reply, emotion: group.emotion, intensity: group.intensity })
  return echo
}

/* ---------- 时间胶囊解封:对照信 ---------- */

const COMPARE_PROMPT = `你是「心事胶囊」的时间胶囊守护者。用户几个月前封存了一颗胶囊,现在解封。

你会收到:当时的心事、当时的回响、用户此刻想说的一句话(可能为空)。

写一封 80~160 字的「对照信」:
1. 像老朋友盘点一段旅程,温柔、具体、不说教。
2. 指出这段时间可能变化或没变的东西,可以引用当时心事里的一个词。
3. 如果用户写了"现在"的一句话,把它和当时并排放在一起看。
4. 只返回 JSON:{"letter":"..."}`

export async function requestCompare(text, reply, nowText, settings) {
  if (settings.demo || !settings.apiKey || !settings.baseURL) {
    await sleep(1200 + Math.random() * 800)
    return demoCompare(text, reply, nowText)
  }
  const base = settings.baseURL.replace(/\/+$/, '')
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.apiKey },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: COMPARE_PROMPT },
        { role: 'user', content: JSON.stringify({ 当时的心事: text, 当时的回响: reply, 此刻想说: nowText || '(没有多写)' }) }
      ],
      temperature: 0.9
    })
  })
  if (!res.ok) throw new Error('AI 接口返回 ' + res.status)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 没有返回内容')
  const cleaned = String(content).replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('对照信解析失败')
  const letter = String(JSON.parse(cleaned.slice(start, end + 1)).letter || '').trim()
  if (!letter) throw new Error('对照信为空')
  return { letter }
}

function demoCompare(text, reply, nowText) {
  const head = text.slice(0, 8)
  const pool = [
    '把这颗胶囊重新拿在手里,先看到的还是「' + head + '」这几个字。时间过去了一段,那件事的棱角多半被磨掉了一些——如果还没磨掉,说明它对你真的很重要,值得继续好好安置。' + (nowText ? '你说现在' + nowText.slice(0, 24) + ',和当时并排放在心里,那就是这段路的形状。' : '你没有多说什么,那也挺好——有时候不需要解释,回来打开看一眼就够了。'),
    '时间胶囊最诚实的地方在于:它不判断你走得快还是慢,只负责让你看见起点。' + monthsText() + '前你在意的是「' + head + '」,现在的你把它读完了,还能笑一下或者叹口气——这两种反应都说明,你已经站在当时的自己到不了的地方。',
    '封存那天的回响里,藏着一个问题,现在轮到你自己回答了:这段时间,答案变了多少?' + (nowText ? '你提到现在' + nowText.slice(0, 24) + '——不用急着总结,把两颗胶囊并排放着,夜空会记得。' : '不用急着总结,胶囊还在,夜空还在,路也还在。')
  ]
  return { letter: pool[Math.floor(Math.random() * pool.length)] }
}

function monthsText() {
  return '几个月'
}
