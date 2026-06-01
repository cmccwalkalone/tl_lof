const TENCENT_URL = 'https://qt.gtimg.cn/q='
const FUND_GZ_URL = 'https://fundgz.1234567.com.cn/js/'
const FUND_PINGZHONG_URL = 'https://fund.eastmoney.com/pingzhongdata/'

function apiLog(type, message) {
  if (typeof window !== 'undefined' && window.addLog) {
    window.addLog(type, message);
  }
  console.log(`[API ${type}] ${message}`);
}

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
    // 🚀 并行请求所有API！
    apiLog('info', `并行获取: ${code}`);
    
    const [priceRes, gzRes, infoRes] = await Promise.all([
      requestTencent(priceUrl),
      requestFundGZViaNetlify(code),
      requestFundInfo(code)
    ])

    // 处理价格
    if (priceRes.success) {
      price = priceRes.price
      priceName = priceRes.name
      volume = priceRes.volume
    }

    // 处理净值
    if (gzRes.success) {
      nav = gzRes.nav
      navName = gzRes.name
      jzrq = gzRes.jzrq
    } else {
      // 如果Netlify失败，再试一下东财
      const pzRes = await requestPingzhong(code)
      if (pzRes.success) {
        nav = pzRes.nav
        navName = navName || pzRes.name
        jzrq = jzrq || pzRes.jzrq
      }
    }

    // 处理基金信息
    if (infoRes.success) {
      status = infoRes.status || ''
      limit = infoRes.limit || '--'
    }

  } catch (e) {
    apiLog('error', `${code} 异常: ${e.message}`);
  }

  const premium = nav > 0 && price > 0 ? ((price - nav) / nav * 100) : 0
  const success = price > 0;

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
    const code = url.split('=').pop();
    const apiUrl = `/api/tencent?code=${code}`;

    const response = await fetch(apiUrl, {
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
    return { success: false }
  }
}

async function requestFundGZViaNetlify(code) {
  const apiUrl = `/api/fund?code=${code}`;

  try {
    const response = await fetch(apiUrl, {
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
  const apiUrl = `/api/pingzhong?code=${code}`;

  try {
    const response = await fetch(apiUrl, {
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
    return { success: false }
  }
}

async function requestFundInfo(code) {
  const apiUrl = `/api/fundinfo?code=${code}`;

  try {
    const response = await fetch(apiUrl, {
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
  apiLog('info', `批量获取: ${codes.join(', ')}`);
  return Promise.all(codes.map(code => getFundDataByCode(code)))
}

async function fetchAllFundData() {
  apiLog('info', '🚀 开始并行获取所有基金数据');

  const categories = getCustomCategories()
  const result = {
    updateTime: getCurrentTime(),
    categories: {}
  }

  // 收集所有基金代码
  const allFundTasks = []
  const allCategoryKeys = Object.keys(categories)
  
  // 并行获取所有基金！
  for (const [key, category] of Object.entries(categories)) {
    for (const code of category.funds) {
      allFundTasks.push({
        categoryKey: key,
        categoryName: category.name,
        code: code,
        promise: getFundDataByCode(code)
      })
    }
  }

  apiLog('info', `并行获取 ${allFundTasks.length} 个基金数据`);

  // 同时等待所有请求完成
  const results = await Promise.all(allFundTasks.map(task => task.promise))

  // 按分类整理结果
  for (const key of allCategoryKeys) {
    result.categories[key] = { name: categories[key].name, items: [] }
  }

  let successCount = 0
  allFundTasks.forEach((task, idx) => {
    if (results[idx].success) {
      result.categories[task.categoryKey].items.push(results[idx])
      successCount++
    }
  })

  apiLog('success', `🎉 全部完成! 成功 ${successCount}/${allFundTasks.length} 个基金`);

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
