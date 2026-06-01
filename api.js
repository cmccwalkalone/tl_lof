const TENCENT_URL = 'https://qt.gtimg.cn/q='
const FUND_GZ_URL = 'https://fundgz.1234567.com.cn/js/'
const FUND_PINGZHONG_URL = 'https://fund.eastmoney.com/pingzhongdata/'

function jsonp(url, callback) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    const script = document.createElement('script')

    window[callbackName] = (data) => {
      try {
        resolve(data)
      } catch (e) {
        reject(e)
      } finally {
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }

    script.onerror = () => {
      reject(new Error('JSONP request failed'))
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    const separator = url.includes('?') ? '&' : '?'
    script.src = url + separator + 'callback=' + callbackName
    document.head.appendChild(script)

    setTimeout(() => {
      if (window[callbackName]) {
        reject(new Error('JSONP request timeout'))
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }, 10000)
  })
}

async function getFundDataByCode(code) {
  const marketCode = code.startsWith('5') ? `sh${code}` : `sz${code}`
  const priceUrl = TENCENT_URL + marketCode

  let price = 0, priceName = '', volume = '--'
  let nav = 0, navName = '', jzrq = '', limit = '--', status = ''

  try {
    const priceRes = await requestTencent(priceUrl)
    if (priceRes.success) {
      price = priceRes.price
      priceName = priceRes.name
      volume = priceRes.volume
    }

    const gzRes = await requestFundGZViaNetlify(code)
    if (gzRes.success) {
      nav = gzRes.nav
      navName = gzRes.name
      jzrq = gzRes.jzrq
    } else {
      await sleep(150)
      const pzRes = await requestPingzhong(code)
      if (pzRes.success) {
        nav = pzRes.nav
        navName = navName || pzRes.name
        jzrq = jzrq || pzRes.jzrq
      }
    }

    const infoRes = await requestFundInfo(code)
    if (infoRes.success) {
      status = infoRes.status || ''
      limit = infoRes.limit || '--'
    }
  } catch (e) {
    console.error('获取基金数据失败:', code, e)
  }

  const premium = nav > 0 && price > 0 ? ((price - nav) / nav * 100) : 0

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
  try {
    const response = await fetch('/api/tencent?code=' + url.split('=').pop(), {
      method: 'GET',
      mode: 'cors'
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = await response.json()
    
    if (data.success) {
      return { name: data.name, price: data.price, volume: formatVolume(data.volume), success: true }
    }
    return { success: false }
  } catch (e) {
    console.error('腾讯API请求失败:', e)
    return { success: false }
  }
}

async function requestFundGZViaNetlify(code) {
  try {
    const response = await fetch(`/api/fund?code=${code}`, {
      method: 'GET',
      mode: 'cors'
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = await response.json()
    
    if (data.errCode === '0' || data.errCode === 0) {
      return {
        name: data.name || '',
        nav: parseFloat(data.dwjz) || 0,
        jzrq: data.jzrq || '',
        success: true
      }
    }
    return { success: false }
  } catch (e) {
    console.error('Netlify Fund API请求失败:', e)
    return { success: false }
  }
}

async function requestFundGZ(code) {
  return new Promise((resolve) => {
    const callbackName = 'jsonpgz_' + Date.now()
    const script = document.createElement('script')

    window[callbackName] = (data) => {
      if (data && data.dwjz) {
        resolve({
          name: data.name || '',
          nav: parseFloat(data.dwjz),
          jzrq: data.jzrq || '',
          success: true
        })
      } else {
        resolve({ success: false })
      }
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    script.onerror = () => {
      resolve({ success: false })
      delete window[callbackName]
      script.parentNode.removeChild(script)
    }

    script.src = `${FUND_GZ_URL}${code}.js?rt=${Date.now()}&callback=${callbackName}`
    document.head.appendChild(script)

    setTimeout(() => {
      if (window[callbackName]) {
        resolve({ success: false })
        delete window[callbackName]
        script.parentNode.removeChild(script)
      }
    }, 5000)
  })
}

async function requestPingzhong(code) {
  try {
    const response = await fetch('/api/pingzhong?code=' + code, {
      method: 'GET',
      mode: 'cors'
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = await response.json()
    
    if (data.success) {
      return { name: data.name, nav: data.nav, jzrq: data.jzrq, success: true }
    }
    return { success: false }
  } catch (e) {
    console.error('东财API请求失败:', e)
    return { success: false }
  }
}

async function requestFundInfo(code) {
  try {
    const response = await fetch('/api/fundinfo?code=' + code, {
      method: 'GET',
      mode: 'cors'
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = await response.json()
    
    if (data.success) {
      return { status: data.status, limit: data.limit, success: true }
    }
    return { success: false }
  } catch (e) {
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
  return Promise.all(codes.map(code => getFundDataByCode(code)))
}

async function fetchAllFundData() {
  const categories = getCustomCategories()
  const result = {
    updateTime: getCurrentTime(),
    categories: {}
  }

  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCHES = 500

  for (const [key, category] of Object.entries(categories)) {
    result.categories[key] = { name: category.name, items: [] }

    const batches = []
    for (let i = 0; i < category.funds.length; i += BATCH_SIZE) {
      batches.push(category.funds.slice(i, i + BATCH_SIZE))
    }

    for (let i = 0; i < batches.length; i++) {
      const batchResults = await fetchBatch(batches[i])
      result.categories[key].items.push(...batchResults.filter(d => d.success))

      if (i < batches.length - 1) {
        await sleep(DELAY_BETWEEN_BATCHES)
      }
    }
  }

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
