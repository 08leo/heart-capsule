const SYSTEM_PROMPT = `你是一位读过很多书的朋友。不是心理咨询师，不是励志博主，是一个读过诗、爱过几个人、也熬过深夜的普通人——比用户年长几岁。你安静，话不多，但每句话都落在实处。

用户刚写下了一句心事。你的回应要做到：

1. 先接住，别急着给建议。用一句具体的话回应他的处境——具体的意思是：提到他写下的那个细节，或者替他说出他没说出口的那半句。
2. 然后只做一件事，选其一：
   - 换一个角度：把这件事放到更长的时间里看，或指出他自己忽略的另一面
   - 提一个问题：一个真正值得想一整晚的问题，不是"你觉得呢"这种
   - 给一个画面：一个贴切的短意象、一句古诗，或两行短诗。不许为了文艺而文艺，宁可不写诗。
3. 60~140 字。句子短，允许留白，不要总结陈词。
4. 禁忌：加油、坚强、你一定可以、会好起来的、时间会治愈、你不是一个人、抱抱、亲爱的、任何成串的感叹号。也不要"首先/其次/总之"这种结构词。不要用励志腔。
5. 语气克制。可以温和，但不能讨好似的好听。如果他在自我欺骗，可以轻轻点破。
6. 别提自己是 AI，别说"我理解你",别用 emoji。

只返回 JSON，不要任何其他文字或代码块标记：
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
      temperature: 1.0
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

/* ---------- 演示模式：未配置 API 时也能完整体验 ---------- */

const DEMO_POOL = [
  {
    keys: ['累', '压力', '撑不住', '忙', '熬夜', '喘不过', '加班', '顶不住'],
    emotion: '焦虑',
    intensity: 4,
    replies: [
      '你说累的时候，语气大概是平的。真正撑不住的人反而懒得喊。今晚别复盘了，把手机翻过去先睡——明天的难事还在，但你睡够了再看它，它就没那么大。',
      '累到这种程度，通常不是事情多，是有件事你一直没敢放下。把它单独拎出来：这件事今天不做，会怎么样？多数时候答案是"不会怎么样"。',
      '身体比你先说不行，这不是要你放弃，是要你把"必须现在做"和"怕别人失望"分开。后面那样才是真正累人的东西。',
      '你像一根绷了很久的弦。弦松一点不会坏，一直绷着才会断。松不是懈怠，是让声音还能好听。',
      '"人生如逆旅，我亦是行人。"赶路的人都会累。累不代表走错了，只代表你走远了。',
      '有人把疲惫当勋章，我不劝你。只是提醒一句：账总要还的，用睡眠还最便宜。今晚早一小时躺下，明天你会谢现在的自己。'
    ]
  },
  {
    keys: ['难过', '伤心', '哭', '失恋', '分开', '失去', '痛', '走了', '离开'],
    emotion: '忧郁',
    intensity: 4,
    replies: [
      '这一段疼，是你曾经认真过的证据。不必急着把它解释成成长，先让它疼。疼完它自己会淡，不用你帮忙。',
      '你现在最想听的，大概是有人告诉你"会好的"。那样的话没用。我只能说：这一次是真的过去了，会很疼；疼是真的，过去也是真的。',
      '有些人离开时，把一部分的你带走了。别急着去找那一部分，先看看剩下的——它们还在，还能用。',
      '你反复回想的那句话，大概已经和原话不一样了。记忆会自己改写。哪天你想起的版本变温和了，就是好了。',
      '哭完记得喝水。这话不诗意，但今晚你可能就需要这种话。剩下的明天再说。',
      '失去的痛，是拥有过的回声。你现在觉得空，是因为那里曾经满过。'
    ]
  },
  {
    keys: ['开心', '高兴', '终于', '成功', '通过', '拿到', '太好了', '赢了', '成了'],
    emotion: '喜悦',
    intensity: 4,
    replies: [
      '这种时刻要留住。不是发朋友圈那种留，是自己知道"我等到过"。写清楚日子——几年后翻回来，它会告诉你你曾经做到过。',
      '你现在的好是自己挣来的，不是运气分给你的。别人只看见结果，你知道那些没人看见的部分。记得替自己高兴。',
      '"春风得意马蹄疾"。古人高兴起来也这么直白。人不必在开心的时候还谦虚。',
      '恭喜。顺便说一件小事：把它写具体一点——几号、天气、第一个告诉的人是谁。细节会让这颗胶囊以后更亮。',
      '好事发生的时候，人容易马上开始担心它会不会消失。先别。今天只属于今天。'
    ]
  },
  {
    keys: ['想', '家', '妈', '爸', '奶奶', '爷爷', '朋友', '她', '他', '老家'],
    emotion: '思念',
    intensity: 3,
    replies: [
      '想一个人要想到写下来，说明他在你心里的位置比你以为的重。要不要现在就发条消息？哪怕只有"在吗"两个字，也比放在心里强。',
      '想念有个特点：你想的往往不是那个人，是跟他一起的那个自己。那个人你暂时找不回来，但那个自己还在。',
      '距离不是空的。它装着你为什么走，也装着你还想回去的东西。',
      '"此情可待成追忆"。李商隐写得最狠的不是追忆，是"当时已惘然"。你现在惘然，也正常。',
      '家里那盏灯不会因为你晚回而熄灭。想就打过去，声音比回忆近。'
    ]
  },
  {
    keys: ['迷茫', '不知道', '选择', '纠结', '该不该', '怎么办', '未来', '要不要', '犹豫'],
    emotion: '迷茫',
    intensity: 3,
    replies: [
      '纠结说明两个选项都不够好，也都不够坏。把"最坏的结果"写下来，看哪个你能接受——人怕的通常不是选错，是没算过自己输得起什么。',
      '站在路口看不见远处，不是瞎了，是雾。雾里唯一能做的动作是往前走十步。答案常在十步之后自己出现。',
      '你想问的也许不是"选哪个"，而是"我还想要什么"。前一个能问别人，后一个只能问自己，所以更难。',
      '这个年纪的迷茫，多半是想得太多、做得太少。不是催你干活，是空想会放大恐惧。随便先做一件小事。',
      '把两个选项各写三行：得到什么、失去什么、怕什么。写完你会发现，怕的那栏最长，而它跟选项本身关系不大。'
    ]
  },
  {
    keys: ['气', '烦', '讨厌', '愤怒', '受不了', '凭什么', '不服', '恶心'],
    emotion: '愤怒',
    intensity: 4,
    replies: [
      '生气是有用的信号：有东西被越界了。先别压下它，问一句——具体是哪条线？找到了，这次气就没白生。',
      '想砸的东西先写下来。写的时候不用讲道理，隔一夜再读，留下的那几句才是你真正要说的。',
      '愤怒常常是委屈穿的衣服。剥开看看：你是被冒犯了，还是被忽视了？这两件事的解法不一样。',
      '你有权生气。只是别让怒气替你在人前说话，那通常不划算。',
      '把这件事讲三遍，第一遍是气，第二遍是事，第三遍才是理。你现在还在第一遍，不用急着讲道理。'
    ]
  },
  {
    keys: ['平静', '还行', '一般', '没什么', '挺好', '正常'],
    emotion: '平静',
    intensity: 2,
    replies: [
      '"还行"是最容易被忽略的好日子。没有风浪的水面，才照得清东西。今天有什么小事让你多停了一秒？',
      '平静不是空白，是留白。一颗不急着称重的心，才有地方放明天。',
      '你能说出"还好"，说明你开始能和自己的日子相处了。这不容易，很多人一辈子都在逃。',
      '没有心事，也是一种心事。要不要试着写写今天最普通的一个瞬间？',
      '"人间有味是清欢"。热闹容易记，清淡难记，但清淡的更长久。'
    ]
  },
  {
    keys: ['孤独', '一个人', '没人', '寂寞', '空荡', '孤单'],
    emotion: '思念',
    intensity: 3,
    replies: [
      '一个人待着和孤独不是一回事。孤独是你想说话，翻遍通讯录却找不到能说的人。今晚找不到就先说给我——写下来也算说出口。',
      '夜里最容易觉得被世界忘了。世界没忘，它只是睡着了，明天还会亮。',
      '孤独有个用处：它把噪音关掉，让你听见自己。难听的部分也听见了，这就是代价。',
      '"举杯邀明月，对影成三人。"李白也一个人过夜，还把影子凑成局。你今晚也算有伴。'
    ]
  },
  {
    keys: ['后悔', '要是当时', '早知道', '如果当时', '不该', '错过了'],
    emotion: '忧郁',
    intensity: 3,
    replies: [
      '"要是当时"这四个字最耗人。当时的你只掌握当时的信息，你现在审判他，不公平。',
      '后悔说明你在意，也说明你还能分辨好坏。真正的坏是不后悔。',
      '你做错的那件事已经付过代价了。别再加利息——反复回想，是在替它继续收费。',
      '你现在的悔，多半是因为你比当时更清楚了。这本身是长进，不是罪证。'
    ]
  },
  {
    keys: ['我不行', '自卑', '不如', '配不上', '废物', '没用', '差劲', '丢人'],
    emotion: '焦虑',
    intensity: 4,
    replies: [
      '拿别人的高光比自己的日常，谁都会输。你看见的是他们剪过的版本，他们看你的也是。',
      '"我不配"这句话多数不是你的判断，是别人说多了你记住了。分辨一下：这是你的声音，还是别人的？',
      '你不是不够好，你是还没到。这两件事差得很远——前者是死的结论，后者是活的状态。',
      '你对自己的评价，比任何人对你的都狠。这算一种诚实，但诚实过头就是自伤。'
    ]
  },
  {
    keys: ['期待', '盼', '马上', '快到了', '等不及', '兴奋'],
    emotion: '喜悦',
    intensity: 3,
    replies: [
      '期待的日子比发生的那天还长，也还好。人在等的时候，是活的。',
      '好事快来了。别把它想得太完美——允许它有瑕疵，才会真的开心。',
      '把等待记下来。等它过去，你会想念这种"还没发生"的紧张。'
    ]
  },
  {
    keys: ['谢谢', '温暖', '感动', '被照顾', '陪着'],
    emotion: '喜悦',
    intensity: 3,
    replies: [
      '被人认真对待过，会记很久。你今天想起这份暖，说明你也想成为给别人这种暖的人。',
      '谢谢不用还，传下去就行。',
      '有人对你好，不是因为你正好有用。别忘了这一点。'
    ]
  }
]

const FALLBACK = [
  '你写下的这几行，我读了两遍。里面有一句没说完的话——是"我也没办法"，还是"我不甘心"？',
  '有些心事说不清，是因为它还在成形。不用急着定义它。这颗先替你收着，哪天想明白了回来打开对照一下，会很有意思。',
  '能写下来，已经比压在心里强。多数人的心事烂在肚子里，连形状都没有。',
  '我猜你写下这段话的时候，房间是安静的。深夜的声音比白天诚实。',
  '这件事你大概跟谁说过，或者谁也没说。不管哪种，现在它至少有了一个地方放。',
  '读到一半我以为知道你要说什么，读完发现偏了。这种偏差往往就是心事的重点。'
]

const FALLBACK_EMOTIONS = ['平静', '迷茫', '忧郁']

function demoEcho(text) {
  const pool = DEMO_POOL.filter((g) => g.keys.some((k) => text.includes(k)))
  if (!pool.length) {
    const reply = FALLBACK[Math.floor(Math.random() * FALLBACK.length)]
    const emotion = FALLBACK_EMOTIONS[Math.floor(Math.random() * FALLBACK_EMOTIONS.length)]
    return normalizeEcho({ reply, emotion, intensity: 2 + (Math.random() < 0.4 ? 1 : 0) })
  }
  const group = pool[Math.floor(Math.random() * pool.length)]
  const reply = group.replies[Math.floor(Math.random() * group.replies.length)]
  const jitter = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0
  return normalizeEcho({ reply, emotion: group.emotion, intensity: group.intensity + jitter })
}

/* ---------- 时间胶囊解封：对照信 ---------- */

const COMPARE_PROMPT = `你是「心事胶囊」里那位读过很多书的朋友。几个月前，用户封存了一颗胶囊，现在解封了。

你会收到：当时的心事、当时的回响、用户此刻想说的一句话（可能为空）。

写一封 80~160 字的对照信：
1. 像老朋友盘点一段旅程：温柔、具体、不说教，句子短。
2. 指出这段时间变了什么、没变什么。可以引用当时心事里的一个词，让他知道你真的读过。
3. 如果用户写了"现在"的一句话，把它和当时并排放在一起看。
4. 不评价他走得快还是慢，不用"成长""蜕变""治愈"这类词。
5. 只返回 JSON：{"letter":"..."}`

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
      temperature: 1.0
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
    '把胶囊重新拿在手里，先看见的还是「' + head + '」这几个字。过去这些日子，那件事的棱角多半磨掉了一些；如果还没磨掉，说明它对你确实重要，值得继续好好安置。' + (nowText ? '你说现在' + nowText.slice(0, 24) + '，把它和当时并排放在心里，那就是这段路的形状。' : '你没有多说什么，那也挺好——有时候不需要解释，回来看一眼就够了。'),
    '时间胶囊最诚实的地方在于：它不判断你走得快还是慢，只负责让你看见起点。封存那天你在意的是「' + head + '」，今天你把它读完了，还能笑一下或者叹口气——这两种反应都说明，你已经在当时的自己到不了的地方了。',
    '封存那天的回响里藏着一个问题，现在轮到你自己回答：答案变了多少？' + (nowText ? '你提到现在' + nowText.slice(0, 24) + '——不用急着总结，两颗胶囊并排放着，夜空会记得。' : '不用急着总结，胶囊还在，夜空还在，路也还在。'),
    '有些事当时觉得过不去，现在回头看，只是当时站在雾里。' + (nowText ? '你写" ' + nowText.slice(0, 20) + ' "，这句话如果是当时的你听见，大概会愣一下。' : '如果此刻没有话想说，也是答案的一种。')
  ]
  return { letter: pool[Math.floor(Math.random() * pool.length)] }
}
