const TENCENT_URL = 'https://qt.gtimg.cn/q='
const FUND_GZ_URL = 'https://fundgz.1234567.com.cn/js/'
const FUND_PINGZHONG_URL = 'https://fund.eastmoney.com/pingzhongdata/'

const DEBUG_MODE = true

function log(type, message, data = null) {
  if (!DEBUG_MODE) return

  const timestamp = new Date().toLocaleTimeString()
  const prefix = `[${timestamp}] [${type.toUpperCase()}]`

  console.log(prefix, message, data || '')

  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('apiLog', {
      detail: { type, message, data, timestamp }
    }))
  }
}

function jsonp(url, callback) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    const script = document.createElement('script')

    log('debug', 'JSONP 请求开始', { url, callbackName })

    window[callbackName] = (data) => {
      try {
        log('debug', 'JSONP 收到数据', { callbackName, hasData: !!data })
        resolve(data)
      } catch (e) {
        log('error', 'JSONP 处理异常', e)
        reject(e)
      } finally {
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }

    script.onerror = () => {
      log('error', 'JSONP 请求失败', { url })
      reject(new Error('JSONP request failed'))
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    const separator = url.includes('?') ? '&' : '?'
    script.src = url + separator + 'callback=' + callbackName
    document.head.appendChild(script)

    setTimeout(() => {
      if (window[callbackName]) {
        log('warning', 'JSONP 请求超时', { url })
        reject(new Error('JSONP request timeout'))
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }, 10000)
  })
}

async function getFundDataByCode(code) {
  log('info', `开始获取基金数据: ${code}`)

  const marketCode = code.startsWith('5') ? `sh${code}` : `sz${code}`
  const priceUrl = TENCENT_URL + marketCode

  let price = 0, priceName = '', volume = '--'
  let nav = 0, navName = '', jzrq = '', limit = '--', status = ''

  try {
    log('debug', '请求价格数据', { code, marketCode, priceUrl })

    const priceRes = await requestTencent(priceUrl)
    log('result', '价格请求结果', priceRes)

    if (priceRes.success) {
      price = priceRes.price
      priceName = priceRes.name
      volume = priceRes.volume
      log('success', `获取到价格: ${price}`, { price, name: priceName, volume })
    } else {
      log('warning', '价格获取失败', { code })
    }

    log('debug', '请求净值数据', { code })

    const gzRes = await requestFundGZViaNetlify(code)
    log('result', '净值请求结果 (Netlify)', gzRes)

    if (gzRes.success) {
      nav = gzRes.nav
      navName = gzRes.name
      jzrq = gzRes.jzrq
      log('success', `获取到净值: ${nav}`, { nav, name: navName, jzrq })
    } else {
      log('warning', 'Netlify 净值获取失败，尝试备用方案', { code })
      await sleep(150)
      const pzRes = await requestPingzhong(code)
      log('result', '净值请求结果 (东财)', pzRes)

      if (pzRes.success) {
        nav = pzRes.nav
        navName = navName || pzRes.name
        jzrq = jzrq || pzRes.jzrq
        log('success', `通过东财获取到净值: ${nav}`, { nav, name: navName, jzrq })
      } else {
        log('error', '所有净值获取方式都失败', { code })
      }
    }

    log('debug', '请求基金信息', { code })

    const infoRes = await requestFundInfo(code)
    log('result', '基金信息请求结果', infoRes)

    if (infoRes.success) {
      status = infoRes.status || ''
      limit = infoRes.limit || '--'
      log('success', '获取到基金信息', { status, limit })
    } else {
      log('warning', '基金信息获取失败', { code })
    }
  } catch (e) {
    log('error', '获取基金数据异常', { code, error: e.message })
    console.error('获取基金数据失败:', code, e)
  }

  const premium = nav > 0 && price > 0 ? ((price - nav) / nav * 100) : 0

  log('info', `基金 ${code} 数据处理完成`, {
    name: navName || priceName || '',
    price,
    nav,
    premium: premium.toFixed(2) + '%',
    success: price > 0
  })

  return {
    code: code,
    name: navName || priceName || '',
    nav: nav,
    navStr: nav > 0 ? Number(nav).toFixed(4) : '--',
    price: price,
    priceStr: price > 0 ? Number(price).toFixed(4) : '--',
    premium: premium,
    premiumText: nav > 0 && price > 0 ? (premium >= 0 ? `+${premium.toFixed(2)}%` : `${premium.toFixed(2)}%`) : '--',
    updateTime: getCurrentTime(),
    jzrq: jzrq,
    volume: volume,
    status: status,
    limit: limit,
    success: price > 0
  }
}

async function requestTencent(url) {
  log('debug', '腾讯API请求', { url })

  try {
    const response = await fetch('/api/tencent?code=' + url.split('=').pop(), {
      method: 'GET',
      mode: 'cors'
    })

    log('debug', '腾讯API响应', { status: response.status, ok: response.ok })

    if (!response.ok) {
      log('error', '腾讯API HTTP错误', { status: response.status })
      return { success: false }
    }

    const data = await response.json()
    log('debug', '腾讯API数据解析', data)

    if (data.success) {
      log('success', '腾讯API成功', data)
      return { name: data.name, price: data.price, volume: formatVolume(data.volume), success: true }
    } else {
      log('warning', '腾讯API返回失败', data)
      return { success: false }
    }
  } catch (e) {
    log('error', '腾讯API请求异常', e)
    console.error('腾讯API请求失败:', e)
    return { success: false }
  }
}

async function requestFundGZViaNetlify(code) {
  log('debug', 'Netlify Fund API请求', { code })
  log('debug', '请求URL', { url: `/api/fund?code=${code}` })

  try {
    const response = await fetch(`/api/fund?code=${code}`, {
      method: 'GET',
      mode: 'cors'
    })

    log('debug', 'Netlify Fund API响应', { status: response.status, ok: response.ok })

    if (!response.ok) {
      log('error', 'Netlify Fund API HTTP错误', { status: response.status })
      return { success: false }
    }

    const data = await response.json()
    log('debug', 'Netlify Fund API数据', data)

    if (data.errCode === '0' || data.errCode === 0) {
      log('success', 'Netlify Fund API成功', data)
      return {
        name: data.name || '',
        nav: parseFloat(data.dwjz) || 0,
        jzrq: data.jzrq || '',
        success: true
      }
    } else {
      log('warning', 'Netlify Fund API返回错误', data)
      return { success: false }
    }
  } catch (e) {
    log('error', 'Netlify Fund API请求异常', e)
    console.error('Netlify Fund API请求失败:', e)
    return { success: false }
  }
}

async function requestFundGZ(code) {
  return new Promise((resolve) => {
    const callbackName = 'jsonpgz_' + Date.now()
    const script = document.createElement('script')

    log('debug', '天天基金JSONP请求', { code, callbackName })

    window[callbackName] = (data) => {
      if (data && data.dwjz) {
        log('success', '天天基金JSONP成功', data)
        resolve({
          name: data.name || '',
          nav: parseFloat(data.dwjz),
          jzrq: data.jzrq || '',
          success: true
        })
      } else {
        log('warning', '天天基金JSONP数据无效', data)
        resolve({ success: false })
      }
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    script.onerror = () => {
      log('error', '天天基金JSONP失败', { code })
      resolve({ success: false })
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    script.src = `${FUND_GZ_URL}${code}.js?rt=${Date.now()}&callback=${callbackName}`
    document.head.appendChild(script)

    setTimeout(() => {
      if (window[callbackName]) {
        log('warning', '天天基金JSONP超时', { code })
        resolve({ success: false })
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }, 5000)
  })
}

async function requestPingzhong(code) {
  log('debug', '东财平层API请求', { code })
  log('debug', '请求URL', { url: `/api/pingzhong?code=${code}` })

  try {
    const response = await fetch('/api/pingzhong?code=' + code, {
      method: 'GET',
      mode: 'cors'
    })

    log('debug', '东财平层API响应', { status: response.status, ok: response.ok })

    if (!response.ok) {
      log('error', '东财平层API HTTP错误', { status: response.status })
      return { success: false }
    }

    const data = await response.json()
    log('debug', '东财平层API数据', data)

    if (data.success) {
      log('success', '东财平层API成功', data)
      return { name: data.name, nav: data.nav, jzrq: data.jzrq, success: true }
    } else {
      log('warning', '东财平层API返回失败', data)
      return { success: false }
    }
  } catch (e) {
    log('error', '东财平层API请求异常', e)
    console.error('东财API请求失败:', e)
    return { success: false }
  }
}

async function requestFundInfo(code) {
  log('debug', '东财基金信息API请求', { code })
  log('debug', '请求URL', { url: `/api/fundinfo?code=${code}` })

  try {
    const response = await fetch('/api/fundinfo?code=' + code, {
      method: 'GET',
      mode: 'cors'
    })

    log('debug', '东财基金信息API响应', { status: response.status, ok: response.ok })

    if (!response.ok) {
      log('error', '东财基金信息API HTTP错误', { status: response.status })
      return { success: false }
    }

    const data = await response.json()
    log('debug', '东财基金信息API数据', data)

    if (data.success) {
      log('success', '东财基金信息API成功', data)
      return { status: data.status, limit: data.limit, success: true }
    } else {
      log('warning', '东财基金信息API返回失败', data)
      return { success: false }
    }
  } catch (e) {
    log('error', '东财基金信息API请求异常', e)
    console.error('基金信息API请求失败:', e)
    return { success: false }
  }
}

function formatVolume(vol) {
  if (!vol || vol === '--') return '--'
  const v = parseFloat(vol)
  if (isNaN(v) || v <= 0) return '--'
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿'
  if (v >= 10000) return (v / 10000).toFixed(2) + '万'
  return vol.toString()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchBatch(codes) {
  log('debug', '批量获取基金数据', { codes })
  return Promise.all(codes.map(code => getFundDataByCode(code)))
}

async function fetchAllFundData() {
  log('info', '开始获取所有基金数据')

  const categories = getCustomCategories()
  log('debug', '获取到分类', Object.keys(categories))

  const result = {
    updateTime: getCurrentTime(),
    categories: {}
  }

  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCHES = 500

  for (const [key, category] of Object.entries(categories)) {
    log('info', `处理分类: ${category.name}`)
    result.categories[key] = { name: category.name, items: [] }

    const batches = []
    for (let i = 0; i < category.funds.length; i += BATCH_SIZE) {
      batches.push(category.funds.slice(i, i + BATCH_SIZE))
    }

    log('debug', `分类 ${category.name} 分为 ${batches.length} 批`, {
      total: category.funds.length,
      batchSize: BATCH_SIZE
    })

    for (let i = 0; i < batches.length; i++) {
      log('debug', `处理第 ${i + 1}/${batches.length} 批`, { batch: batches[i] })

      const batchResults = await fetchBatch(batches[i])
      log('debug', `第 ${i + 1} 批结果`, {
        count: batchResults.length,
        success: batchResults.filter(r => r.success).length
      })

      result.categories[key].items.push(...batchResults.filter(d => d.success))

      if (i < batches.length - 1) {
        log('debug', `等待 ${DELAY_BETWEEN_BATCHES}ms 后继续`)
        await sleep(DELAY_BETWEEN_BATCHES)
      }
    }

    log('success', `分类 ${category.name} 处理完成`, {
      total: category.funds.length,
      success: result.categories[key].items.length
    })
  }

  log('success', '所有基金数据获取完成', {
    categories: Object.keys(result.categories).length,
    totalItems: Object.values(result.categories).reduce((sum, cat) => sum + cat.items.length, 0)
  })

  return result
}

async function fetchCategoryFundData(categoryKey) {
  const categories = getCustomCategories()
  const category = categories[categoryKey]
  if (!category) return null

  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCHES = 500

  const batches = []
  for (let i = 0; i < category.funds.length; i += BATCH_SIZE) {
    batches.push(category.funds.slice(i, i + BATCH_SIZE))
  }

  const items = []
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await fetchBatch(batches[i])
    items.push(...batchResults.filter(d => d.success))

    if (i < batches.length - 1) {
      await sleep(DELAY_BETWEEN_BATCHES)
    }
  }

  return { name: category.name, items }
}

log('info', 'api-debug.js 已加载')
