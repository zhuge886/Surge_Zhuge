/**
 * Sub-Store 节点订阅 -> Clash Verge Rev / Mihomo 完整分流脚本
 *
 * 用途：输入配置只需要包含 proxies，本脚本会自动生成策略组、地区组和规则。
 * 使用：Clash Verge Rev -> 设置 -> 配置 -> 全局扩展脚本，导入或粘贴本文件。
 */

// ==================== 用户开关 ====================

// 自动测速时排除高倍率节点；设为 0 表示不限制。
const MAX_AUTO_RATIO = 3

// 地区组：true 自动选择低延迟；false 手动选择地区内节点。
const REGION_AUTO_TEST = true

// 自动选择组的测速参数。
// 每隔多少秒重新测速；300 = 5 分钟。过短会增加流量和服务器压力。
const AUTO_TEST_INTERVAL = 300

// 节点切换容差（毫秒）。0 = 严格选择当前最低延迟；
// 如果网络波动导致频繁切换，可改为 20～50。
const AUTO_TEST_TOLERANCE = 0

// false 表示即使没有正在使用“自动选择”组，也会按时主动测速。
const AUTO_TEST_LAZY = false

// Mihomo 官方文档推荐的健康检查地址之一。
const AUTO_TEST_URL = 'https://www.gstatic.com/generate_204'
const AUTO_TEST_TIMEOUT = 5000

// 加强广告规则：除了 Mihomo 内置广告库，再加载一份外部 MRS 规则。
const ENABLE_STRONG_ADBLOCK = true

// 默认不强行覆盖 Clash Verge 自己的 DNS/TUN 设置，避免影响当前能用的配置。
const ENABLE_DNS_OVERRIDE = false
const ENABLE_TUN_OVERRIDE = false
const ENABLE_SNIFFER = true

// 自定义规则：左侧只写“规则类型,值”，目标策略由所在数组决定。
// 示例：'DOMAIN-SUFFIX,example.com' 或 'PROCESS-NAME,example.exe'
const CUSTOM_RULES = {
  direct: [],
  proxy: [],
  reject: [],
}

// ==================== 策略组名称 ====================

const G = {
  main: '🚀 节点选择',
  auto: '♻️ 自动选择',
  fallback: '🛟 故障转移',
  balance: '⚖️ 负载均衡',
  direct: '🎯 全球直连',
  china: '🇨🇳 国内网站',
  final: '🐟 漏网之鱼',
  ads: '🛑 广告拦截',
  ai: '🤖 AI 服务',
  google: '🔎 Google',
  youtube: '📺 YouTube',
  telegram: '📨 Telegram',
  github: '🐙 GitHub',
  microsoft: 'Ⓜ️ Microsoft',
  apple: '🍎 Apple',
  streaming: '🎬 国际流媒体',
  games: '🎮 游戏平台',
  download: '⬇️ 下载软件',
  otherNodes: '🌐 其他节点',
}

const REGIONS = [
  { name: '🇭🇰 香港节点', regex: /(?:🇭🇰|香港|Hong\s?Kong|(?:^|[\s_\-|])HK(?:\d|[\s_\-|]|$))/i },
  { name: '🇹🇼 台湾节点', regex: /(?:🇹🇼|台湾|台灣|台北|臺北|Taiwan|Taipei|(?:^|[\s_\-|])TW(?:\d|[\s_\-|]|$))/i },
  { name: '🇯🇵 日本节点', regex: /(?:🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|(?:^|[\s_\-|])JP(?:\d|[\s_\-|]|$))/i },
  { name: '🇸🇬 新加坡节点', regex: /(?:🇸🇬|新加坡|狮城|獅城|Singapore|(?:^|[\s_\-|])SG(?:\d|[\s_\-|]|$))/i },
  { name: '🇺🇸 美国节点', regex: /(?:🇺🇸|美国|美國|United\s?States|Los\s?Angeles|San\s?Jose|Seattle|Dallas|New\s?York|(?:^|[\s_\-|])US(?:\d|[\s_\-|]|$))/i },
  { name: '🇰🇷 韩国节点', regex: /(?:🇰🇷|韩国|韓國|首尔|首爾|Korea|Seoul|(?:^|[\s_\-|])KR(?:\d|[\s_\-|]|$))/i },
  { name: '🇬🇧 英国节点', regex: /(?:🇬🇧|英国|英國|伦敦|倫敦|United\s?Kingdom|London|(?:^|[\s_\-|])(?:UK|GB)(?:\d|[\s_\-|]|$))/i },
  { name: '🇩🇪 德国节点', regex: /(?:🇩🇪|德国|德國|法兰克福|法蘭克福|Germany|Frankfurt|(?:^|[\s_\-|])DE(?:\d|[\s_\-|]|$))/i },
  { name: '🇨🇦 加拿大节点', regex: /(?:🇨🇦|加拿大|Canada|Toronto|Vancouver|(?:^|[\s_\-|])CA(?:\d|[\s_\-|]|$))/i },
  { name: '🇦🇺 澳大利亚节点', regex: /(?:🇦🇺|澳大利亚|澳大利亞|澳洲|Australia|Sydney|Melbourne|(?:^|[\s_\-|])AU(?:\d|[\s_\-|]|$))/i },
  { name: '🇫🇷 法国节点', regex: /(?:🇫🇷|法国|法國|France|Paris|(?:^|[\s_\-|])FR(?:\d|[\s_\-|]|$))/i },
  { name: '🇳🇱 荷兰节点', regex: /(?:🇳🇱|荷兰|荷蘭|Netherlands|Amsterdam|(?:^|[\s_\-|])NL(?:\d|[\s_\-|]|$))/i },
]

const RESERVED_NAMES = new Set([...Object.values(G), ...REGIONS.map((item) => item.name)])

// ==================== 工具函数 ====================

function uniqueNodeNames(proxies) {
  const used = new Set(RESERVED_NAMES)

  return proxies.map((proxy, index) => {
    let base = String(proxy?.name || `未命名节点 ${index + 1}`).trim()
    if (!base) base = `未命名节点 ${index + 1}`

    let name = base
    let suffix = 2
    while (used.has(name)) {
      name = `${base} [${suffix}]`
      suffix += 1
    }

    proxy.name = name
    used.add(name)
    return name
  })
}

function nodeRatio(name) {
  const prefix = name.match(/(?:倍率\s*[:：]?\s*|[x×]\s*)(\d+(?:\.\d+)?)/i)
  if (prefix) return Number(prefix[1])

  const suffix = name.match(/(\d+(?:\.\d+)?)\s*[x×](?:$|[\s_\-|])/i)
  return suffix ? Number(suffix[1]) : 1
}

function isAutoCandidate(name) {
  return MAX_AUTO_RATIO <= 0 || nodeRatio(name) <= MAX_AUTO_RATIO
}

function selectGroup(name, proxies) {
  return { name, type: 'select', proxies: [...new Set(proxies)] }
}

function healthGroup(name, type, proxies, extra = {}) {
  return {
    name,
    type,
    proxies: [...new Set(proxies)],
    url: AUTO_TEST_URL,
    interval: AUTO_TEST_INTERVAL,
    timeout: AUTO_TEST_TIMEOUT,
    lazy: true,
    'expected-status': 204,
    'max-failed-times': 2,
    ...extra,
  }
}

function preferred(regionNames, first, fallback) {
  return regionNames.includes(first)
    ? [first, ...fallback, ...regionNames.filter((name) => name !== first), 'DIRECT']
    : [...fallback, ...regionNames, 'DIRECT']
}

function addTarget(rules, sourceRules, target) {
  for (const rule of sourceRules) {
    if (typeof rule === 'string' && rule.trim()) rules.push(`${rule.trim()},${target}`)
  }
}

// ==================== 可选高级配置 ====================

function applyDnsOverride(config) {
  config.dns = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter-mode': 'blacklist',
    'fake-ip-filter': [
      '*.lan',
      '*.local',
      '*.localhost',
      'time.*.com',
      'ntp.*.com',
      '+.msftconnecttest.com',
      '+.msftncsi.com',
    ],
    'default-nameserver': ['223.5.5.5', '119.29.29.29'],
    nameserver: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
    'proxy-server-nameserver': ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
    'nameserver-policy': {
      'geosite:cn,private': ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
      'geosite:geolocation-!cn': ['https://cloudflare-dns.com/dns-query', 'https://dns.google/dns-query'],
    },
  }
}

function applyTunOverride(config) {
  config.tun = {
    ...(config.tun || {}),
    enable: true,
    stack: 'mixed',
    'auto-route': true,
    'auto-redirect': true,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53', 'tcp://any:53'],
  }
}

function applySniffer(config) {
  config.sniffer = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      TLS: { ports: [443, 8443] },
      HTTP: { ports: [80, '8080-8880'] },
      QUIC: { ports: [443, 8443] },
    },
    'skip-domain': ['Mijia Cloud', '+.oray.com', '+.push.apple.com'],
  }
}

// ==================== 主入口 ====================

function main(config) {
  config.proxies = Array.isArray(config.proxies) ? config.proxies : []
  if (config.proxies.length === 0) {
    throw new Error('订阅中没有可用代理节点，请确认 Sub-Store 输出目标为 ClashMeta')
  }

  const allNodes = uniqueNodeNames(config.proxies)
  const autoNodes = allNodes.filter(isAutoCandidate)
  const testedNodes = autoNodes.length > 0 ? autoNodes : allNodes

  const regionGroups = []
  const matchedNodes = new Set()

  for (const region of REGIONS) {
    const nodes = allNodes.filter((name) => region.regex.test(name))
    if (nodes.length === 0) continue
    nodes.forEach((name) => matchedNodes.add(name))

    const regionAutoNodes = nodes.filter(isAutoCandidate)
    const regionCandidates = regionAutoNodes.length > 0 ? regionAutoNodes : nodes
    regionGroups.push(
      REGION_AUTO_TEST
        ? healthGroup(region.name, 'url-test', regionCandidates, {
            tolerance: AUTO_TEST_TOLERANCE,
            // 地区组仅在被使用时测速，避免和全局自动组重复探测全部节点。
            lazy: true,
          })
        : selectGroup(region.name, nodes),
    )
  }

  const otherNodes = allNodes.filter((name) => !matchedNodes.has(name))
  const regionNames = regionGroups.map((group) => group.name)
  if (otherNodes.length > 0) regionNames.push(G.otherNodes)

  const baseChoices = [G.main, G.auto]
  const serviceChoices = [...baseChoices, ...regionNames, 'DIRECT']

  const groups = [
    selectGroup(G.main, [G.auto, G.fallback, G.balance, ...regionNames, ...allNodes, 'DIRECT']),
    healthGroup(G.auto, 'url-test', testedNodes, {
      tolerance: AUTO_TEST_TOLERANCE,
      lazy: AUTO_TEST_LAZY,
    }),
    healthGroup(G.fallback, 'fallback', testedNodes),
    healthGroup(G.balance, 'load-balance', testedNodes, { strategy: 'consistent-hashing' }),
    selectGroup(G.ai, preferred(regionNames, '🇺🇸 美国节点', baseChoices)),
    selectGroup(G.google, serviceChoices),
    selectGroup(G.youtube, serviceChoices),
    selectGroup(G.telegram, preferred(regionNames, '🇸🇬 新加坡节点', baseChoices)),
    selectGroup(G.github, serviceChoices),
    selectGroup(G.microsoft, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.apple, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.streaming, serviceChoices),
    selectGroup(G.games, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.download, ['DIRECT', G.main, G.auto, 'REJECT', ...regionNames]),
    selectGroup(G.ads, ['REJECT', 'DIRECT']),
    selectGroup(G.china, ['DIRECT', G.main, G.auto]),
    selectGroup(G.direct, ['DIRECT', G.main]),
    selectGroup(G.final, [G.main, G.auto, 'DIRECT', ...regionNames]),
    ...regionGroups,
  ]

  if (otherNodes.length > 0) groups.push(selectGroup(G.otherNodes, otherNodes))

  const rules = []
  addTarget(rules, CUSTOM_RULES.direct, G.direct)
  addTarget(rules, CUSTOM_RULES.proxy, G.main)
  addTarget(rules, CUSTOM_RULES.reject, G.ads)

  rules.push(
    `GEOSITE,private,${G.direct}`,
    `GEOIP,private,${G.direct},no-resolve`,
  )

  if (ENABLE_STRONG_ADBLOCK) rules.push(`RULE-SET,adblock_mihomo,${G.ads}`)

  rules.push(
    `GEOSITE,category-ads-all,${G.ads}`,
    `GEOSITE,openai,${G.ai}`,
    `GEOSITE,category-ai-!cn,${G.ai}`,
    `GEOSITE,youtube,${G.youtube}`,
    `GEOSITE,google,${G.google}`,
    `GEOSITE,telegram,${G.telegram}`,
    `GEOIP,telegram,${G.telegram},no-resolve`,
    `GEOSITE,github,${G.github}`,
    `GEOSITE,microsoft@cn,${G.china}`,
    `GEOSITE,microsoft,${G.microsoft}`,
    `GEOSITE,apple-cn,${G.apple}`,
    `GEOSITE,apple,${G.apple}`,
    `GEOSITE,netflix,${G.streaming}`,
    `GEOSITE,disney,${G.streaming}`,
    `GEOSITE,spotify,${G.streaming}`,
    `GEOSITE,tiktok,${G.streaming}`,
    `GEOSITE,biliintl,${G.streaming}`,
    `GEOSITE,category-games@cn,${G.china}`,
    `GEOSITE,steam@cn,${G.china}`,
    `GEOSITE,category-games,${G.games}`,
    `GEOSITE,cn,${G.china}`,
    `GEOIP,CN,${G.china},no-resolve`,
    `GEOSITE,geolocation-!cn,${G.final}`,
    `MATCH,${G.final}`,
  )

  config.mode = 'rule'
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['global-client-fingerprint'] = 'chrome'
  config.profile = {
    ...(config.profile || {}),
    'store-selected': true,
    'store-fake-ip': true,
  }

  config['geodata-mode'] = true
  config['geodata-loader'] = 'memconservative'
  config['geo-auto-update'] = true
  config['geo-update-interval'] = 24
  config['geox-url'] = {
    geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb',
    asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb',
  }

  if (ENABLE_STRONG_ADBLOCK) {
    config['rule-providers'] = {
      ...(config['rule-providers'] || {}),
      adblock_mihomo: {
        type: 'http',
        behavior: 'domain',
        format: 'mrs',
        interval: 28800,
        path: './ruleset/adblockfilters/adblockmihomo.mrs',
        url: 'https://gcore.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomo.mrs',
      },
    }
  }

  if (ENABLE_DNS_OVERRIDE) applyDnsOverride(config)
  if (ENABLE_TUN_OVERRIDE) applyTunOverride(config)
  if (ENABLE_SNIFFER) applySniffer(config)

  config['proxy-groups'] = groups
  config.rules = rules
  return config
}
