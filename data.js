const fundCategories = {
  europe_america: {
    name: '欧美指数',
    funds: [
      '501312', '501300', '501225', '164906', '164824', '162415',
      '161130', '161128', '161127', '161126', '161125', '160644',
      '160140', '160125'
    ]
  },
  commodity: {
    name: '商品',
    funds: [
      '165513', '161815', '160719', '160216', '164701', '161116',
      '162411', '160723', '161129', '160416', '163208', '162719',
      '501018'
    ]
  },
  asia: {
    name: '亚洲市场',
    funds: [
      '160322', '501301', '501025', '501302', '501303', '161124',
      '160717', '160924', '161831', '501307', '501306', '501021',
      '501310', '164705', '501311', '501305'
    ]
  }
}

const cacheKey = 'fund_data'
const categoriesKey = 'fund_categories'
const cacheExpireMinutes = 30

function getCacheData() {
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const data = JSON.parse(cached)
      const now = Date.now()
      const expireTime = data.timestamp + cacheExpireMinutes * 60 * 1000
      if (now < expireTime) {
        console.log('使用缓存数据')
        return data.data
      }
    }
  } catch (e) {
    console.error('读取缓存失败:', e)
  }
  console.log('使用默认数据')
  return getDefaultData()
}

function setCacheData(data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }))
    console.log('数据已缓存')
    return true
  } catch (e) {
    console.error('写入缓存失败:', e)
    return false
  }
}

function clearCache() {
  try {
    localStorage.removeItem(cacheKey)
    return true
  } catch (e) {
    console.error('清除缓存失败:', e)
    return false
  }
}

function getDefaultData() {
  const data = {
    updateTime: '暂无数据',
    categories: {}
  }

  for (const [key, category] of Object.entries(fundCategories)) {
    data.categories[key] = {
      name: category.name,
      items: []
    }
  }

  return data
}

function getFundCategories() {
  return fundCategories
}

function getCustomCategories() {
  try {
    const stored = localStorage.getItem(categoriesKey)
    if (stored) {
      return JSON.parse(stored)
    }
    return fundCategories
  } catch (e) {
    return fundCategories
  }
}

function addFundToCategory(categoryKey, fundCode) {
  try {
    const categories = JSON.parse(localStorage.getItem(categoriesKey) || JSON.stringify(fundCategories))
    if (categories[categoryKey]) {
      if (!categories[categoryKey].funds.includes(fundCode)) {
        categories[categoryKey].funds.push(fundCode)
        localStorage.setItem(categoriesKey, JSON.stringify(categories))
        clearCache()
        return true
      }
    }
    return false
  } catch (e) {
    console.error('添加基金失败:', e)
    return false
  }
}

function removeFundFromCategory(categoryKey, fundCode) {
  try {
    const categories = JSON.parse(localStorage.getItem(categoriesKey) || JSON.stringify(fundCategories))
    if (categories[categoryKey]) {
      const index = categories[categoryKey].funds.indexOf(fundCode)
      if (index > -1) {
        categories[categoryKey].funds.splice(index, 1)
        localStorage.setItem(categoriesKey, JSON.stringify(categories))
        clearCache()
        return true
      }
    }
    return false
  } catch (e) {
    console.error('删除基金失败:', e)
    return false
  }
}

function resetCategories() {
  try {
    localStorage.removeItem(categoriesKey)
    clearCache()
    return true
  } catch (e) {
    console.error('重置失败:', e)
    return false
  }
}

function getCurrentTime() {
  const now = new Date()
  const pad = n => n < 10 ? '0' + n : n
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
