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
  apiLog('info', `获取基金数据: ${code}`);

  const marketCode = code.startsWith('5') ? `sh${code}` : `sz${code}`
  const priceUrl = TENCENT_URL + marketCode

  let price = 0, priceName = '', volume = '--'
  let nav = 0, navName = '', jzrq = '', limit = '--', status = ''

  try {
    apiLog('info', `请求价格: ${priceUrl}`);
    const priceRes = await requestTencent(priceUrl)

    if (priceRes.success) {
      price = priceRes.price
      priceName = priceRes.name
      volume = priceRes.volume
      apiLog('success', `价格获取成功: ${price}`);
    } else {
      apiLog('warning', `价格获取失败: ${code}`);
    }

    apiLog('info', `请求净值: ${code}`);
    const gzRes = await requestFundGZViaNetlify(code)

    if (gzRes.success) {
      nav = gzRes.nav
      navName = gzRes.name
      jzrq = gzRes.jzrq
      apiLog('success', `净值获取成功: ${nav}`);
    } else {
      apiLog('warning', `Netlify净值获取失败，尝试东财...`);
      await sleep(150)
      const pzRes = await requestPingzhong(code)
      if (pzRes.success) {
        nav = pzRes.nav
        navName = navName || pzRes.name
        jzrq = jzrq || pzRes.jzrq
        apiLog('success', `东财净值获取成功: ${nav}`);
      } else {
        apiLog('error', `所有净值获取方式都失败: ${code}`);
      }
    }

    apiLog('info', `请求基金信息: ${code}`);
    const infoRes = await requestFundInfo(code)
    if (infoRes.success) {
      status = infoRes.status || ''
      limit = infoRes.limit || '--'
      apiLog('success', `基金信息获取成功: ${status}`);
    } else {
      apiLog('warning', `基金信息获取失败`);
    }
  } catch (e) {
    apiLog('error', `异常: ${e.message}`);
    console.error('获取基金数据失败:', code, e)
  }

  const premium = nav > 0 && price > 0 ? ((price - nav) / nav * 100) : 0
  const success = price > 0;

  apiLog(success ? 'success' : 'warning', `基金 ${code} 完成: ${success ? '成功' : '失败'} (价格:${price > 0 ? price : '无'}, 净值:${nav > 0 ? nav : '无'})`);

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
  apiLog('info', `腾讯API: ${url}`);

  try {
    const code = url.split('=').pop();
    const apiUrl = `/api/tencent?code=${code}`;
    apiLog('debug', `请求: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      mode: 'cors'
    })

    apiLog('info', `响应状态: ${response.status}`);

    if (!response.ok) {
      apiLog('error', `HTTP错误: ${response.status}`);
      return { success: false }
    }

    const data = await response.json()
    apiLog('debug', `响应数据: ${JSON.stringify(data)}`);

    if (data.success) {
      apiLog('success', `成功: ${data.price}`);
      return { name: data.name, price: data.price, volume: formatVolume(data.volume), success: true }
    } else {
      apiLog('error', `API返回失败: ${data.error || '未知错误'}`);
      return { success: false }
    }
  } catch (e) {
    apiLog('error', `请求异常: ${e.message}`);
    console.error('腾讯API请求失败:', e)
    return { success: false }
  }
}

async function requestFundGZViaNetlify(code) {
  const apiUrl = `/api/fund?code=${code}`;
  apiLog('info', `Netlify Fund API: ${apiUrl}`);

  try {
    apiLog('debug', `请求: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      mode: 'cors'
    })

    apiLog('info', `响应状态: ${response.status}`);

    if (!response.ok) {
      apiLog('error', `HTTP错误: ${response.status}`);
      return { success: false }
    }

    const data = await response.json()
    apiLog('debug', `响应数据: ${JSON.stringify(data)}`);

    if (data.errCode === '0' || data.errCode === 0) {
      apiLog('success', `成功: ${data.dwjz}`);
      return {
        name: data.name || '',
        nav: parseFloat(data.dwjz) || 0,
        jzrq: data.jzrq || '',
        success: true
      }
    } else {
      apiLog('error', `API返回错误: ${data.errMsg || '未知错误'}`);
      return { success: false }
    }
  } catch (e) {
    apiLog('error', `请求异常: ${e.message}`);
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
  const apiUrl = `/api/pingzhong?code=${code}`;
  apiLog('info', `东财平层API: ${apiUrl}`);

  try {
    apiLog('debug', `请求: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      mode: 'cors'
    })

    apiLog('info', `响应状态: ${response.status}`);

    if (!response.ok) {
      apiLog('error', `HTTP错误: ${response.status}`);
      return { success: false }
    }

    const data = await response.json()
    apiLog('debug', `响应数据: ${JSON.stringify(data)}`);

    if (data.success) {
      apiLog('success', `成功: ${data.nav}`);
      return { name: data.name, nav: data.nav, jzrq: data.jzrq, success: true }
    } else {
      apiLog('error', `API返回失败: ${data.error || '未知错误'}`);
      return { success: false }
    }
  } catch (e) {
    apiLog('error', `请求异常: ${e.message}`);
    console.error('东财API请求失败:', e)
    return { success: false }
  }
}

async function requestFundInfo(code) {
  const apiUrl = `/api/fundinfo?code=${code}`;
  apiLog('info', `基金信息API: ${apiUrl}`);

  try {
    apiLog('debug', `请求: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      mode: 'cors'
    })

    apiLog('info', `响应状态: ${response.status}`);

    if (!response.ok) {
      apiLog('error', `HTTP错误: ${response.status}`);
      return { success: false }
    }

    const data = await response.json()
    apiLog('debug', `响应数据: ${JSON.stringify(data)}`);

    if (data.success) {
      apiLog('success', `成功: ${data.status || '无状态'}`);
      return { status: data.status, limit: data.limit, success: true }
    } else {
      apiLog('error', `API返回失败: ${data.error || '未知错误'}`);
      return { success: false }
    }
  } catch (e) {
    apiLog('error', `请求异常: ${e.message}`);
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
  apiLog('info', `批量获取: ${codes.join(', ')}`);
  return Promise.all(codes.map(code => getFundDataByCode(code)))
}

async function fetchAllFundData() {
  apiLog('info', '开始获取所有基金数据');

  const categories = getCustomCategories()
  const result = {
    updateTime: getCurrentTime(),
    categories: {}
  }

  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCHES = 500

  for (const [key, category] of Object.entries(categories)) {
    apiLog('info', `处理分类: ${category.name} (${category.funds.length}个基金)`);
    result.categories[key] = { name: category.name, items: [] }

    const batches = []
    for (let i = 0; i < category.funds.length; i += BATCH_SIZE) {
      batches.push(category.funds.slice(i, i + BATCH_SIZE))
    }

    apiLog('info', `分为 ${batches.length} 批处理`);

    for (let i = 0; i < batches.length; i++) {
      apiLog('info', `处理第 ${i + 1}/${batches.length} 批`);
      const batchResults = await fetchBatch(batches[i])
      const successCount = batchResults.filter(d => d.success).length;
      apiLog(successCount > 0 ? 'success' : 'warning', `第 ${i + 1} 批完成: ${successCount}/${batches[i].length} 成功`);

      result.categories[key].items.push(...batchResults.filter(d => d.success))

      if (i < batches.length - 1) {
        apiLog('info', `等待 ${DELAY_BETWEEN_BATCHES}ms...`);
        await sleep(DELAY_BETWEEN_BATCHES)
      }
    }
  }

  const totalCount = Object.values(result.categories).reduce((sum, cat) => sum + cat.items.length, 0);
  apiLog('success', `全部完成! 共获取 ${totalCount} 条数据`);

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
