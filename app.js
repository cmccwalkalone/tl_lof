let state = {
  updateTime: '',
  categoryList: [],
  currentTab: 'europe_america',
  currentData: [],
  allData: {},
  loading: false
}

let settingsState = {
  categoryList: [],
  currentTab: 'europe_america',
  currentFunds: []
}

let logPanelVisible = false;
let logMessages = [];

function addLog(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { type, message, timestamp };
  logMessages.push(logEntry);

  console.log(`[${type}] ${message}`);

  const logContent = document.getElementById('logContent');
  if (logContent) {
    const logDiv = document.createElement('div');
    logDiv.style.cssText = 'margin-bottom:8px;padding:8px;border-radius:4px;';

    let bgColor, borderColor, icon;
    switch(type) {
      case 'error':
        bgColor = '#2d1f1f';
        borderColor = '#f44336';
        icon = '❌';
        break;
      case 'success':
        bgColor = '#1f2d1f';
        borderColor = '#4caf50';
        icon = '✅';
        break;
      case 'warning':
        bgColor = '#2d2d1f';
        borderColor = '#ffc107';
        icon = '⚠️';
        break;
      case 'info':
        bgColor = '#1f2d2d';
        borderColor = '#2196f3';
        icon = 'ℹ️';
        break;
      default:
        bgColor = '#252526';
        borderColor = '#666';
        icon = '📝';
    }

    logDiv.style.background = bgColor;
    logDiv.style.borderLeft = `4px solid ${borderColor}`;
    logDiv.innerHTML = `<div style="color:#888;font-size:11px;">${timestamp}</div><div>${icon} ${message}</div>`;

    logContent.insertBefore(logDiv, logContent.firstChild);

    while (logContent.children.length > 100) {
      logContent.removeChild(logContent.lastChild);
    }
  }

  if (!logPanelVisible) {
    const logPanel = document.getElementById('logPanel');
    if (logPanel) {
      logPanel.style.display = 'block';
      logPanelVisible = true;
    }
  }
}

function toggleLogPanel() {
  const logPanel = document.getElementById('logPanel');
  if (logPanel) {
    if (logPanelVisible) {
      logPanel.style.display = 'none';
      logPanelVisible = false;
    } else {
      logPanel.style.display = 'block';
      logPanelVisible = true;
    }
  }
}

function getAllLogs() {
  return logMessages.map(l => `[${l.type.toUpperCase()}] [${l.timestamp}] ${l.message}`).join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
  addLog('info', '页面加载成功，开始初始化...');
  initApp();
});

function initApp() {
  addLog('info', '初始化应用...');
  loadData()
  setupEventListeners()
  setupPullToRefresh()
}

function loadData() {
  addLog('info', '加载数据...');

  const cachedData = getCacheData()
  addLog('info', `读取缓存: ${cachedData.updateTime || '无缓存'}`);

  const categories = getCustomCategories()
  addLog('info', `获取到 ${Object.keys(categories).length} 个分类`);

  const categoryList = Object.entries(categories).map(([key, value]) => ({
    key,
    name: value.name
  }))

  const firstTab = categoryList[0]?.key || 'europe_america'

  state = {
    updateTime: cachedData.updateTime || '',
    categoryList,
    currentTab: firstTab,
    allData: cachedData.categories || {},
    currentData: cachedData.categories?.[firstTab]?.items || [],
    loading: false
  }

  addLog('success', '初始化完成，准备刷新数据...');
  render()
  fetchData()
}

async function fetchData() {
  addLog('info', '开始获取数据...');

  if (state.loading) {
    addLog('warning', '正在加载中，跳过重复请求');
    return
  }

  state.loading = true
  render()
  addLog('info', '显示加载状态');

  try {
    addLog('info', '调用 fetchAllFundData()...');
    const data = await fetchAllFundData()
    addLog('success', 'fetchAllFundData 完成');

    const totalItems = Object.values(data.categories).reduce((sum, cat) => sum + cat.items.length, 0);
    addLog('success', `获取到 ${totalItems} 条基金数据`);

    setCacheData(data)
    addLog('info', '数据已缓存');

    state.allData = data.categories
    state.updateTime = data.updateTime
    state.currentData = data.categories[state.currentTab]?.items || []
    state.loading = false
    addLog('success', '界面更新完成');

    showToast('数据已更新')
    render()
  } catch (e) {
    addLog('error', `获取数据失败: ${e.message}`);
    console.error('获取数据失败:', e)
    showToast('获取数据失败')
    state.loading = false
    render()
  }
}

function refreshData() {
  addLog('info', '用户点击刷新按钮');
  if (state.loading) {
    addLog('warning', '正在加载中，请稍候');
    return
  }
  fetchData()
}

function switchTab(key) {
  console.log('切换Tab:', key)
  state.currentTab = key
  state.currentData = state.allData[key]?.items || []
  render()
}

function showDetail(item) {
  if (!item) return
  const modal = document.getElementById('detailModal')
  const detailName = document.getElementById('detailName')
  const detailBody = document.getElementById('detailBody')

  detailName.textContent = item.name
  detailBody.innerHTML = `
    <div class="detail-item">
      <span class="detail-label">代码</span>
      <span class="detail-value">${item.code}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">净值</span>
      <span class="detail-value">${item.navStr}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">价格</span>
      <span class="detail-value">${item.priceStr}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">溢价率</span>
      <span class="detail-value" style="color: ${item.premium >= 0 ? '#ef4444' : '#22c55e'}">${item.premiumText}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">状态</span>
      <span class="detail-value">${item.status || '--'}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">限额</span>
      <span class="detail-value">${item.limit}</span>
    </div>
    ${item.jzrq ? `
    <div class="detail-item">
      <span class="detail-label">净值日期</span>
      <span class="detail-value">${item.jzrq}</span>
    </div>
    ` : ''}
  `

  modal.classList.add('show')
}

function closeDetail() {
  document.getElementById('detailModal').classList.remove('show')
}

function openSettings() {
  console.log('打开设置')
  loadSettingsData()
  document.getElementById('settingsModal').classList.add('show')
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('show')
}

function loadSettingsData() {
  const categories = getCustomCategories()

  const categoryList = Object.entries(categories).map(([key, value]) => ({
    key,
    name: value.name
  }))

  const currentTab = categoryList[0]?.key || 'europe_america'

  settingsState = {
    categoryList,
    currentTab,
    currentFunds: categories[currentTab]?.funds || []
  }

  renderSettings()
}

function switchSettingsTab(key) {
  const categories = getCustomCategories()

  settingsState.currentTab = key
  settingsState.currentFunds = categories[key]?.funds || []

  renderSettings()
}

function addFund() {
  const input = document.getElementById('newFundCode')
  const code = input.value.trim()

  if (!code) {
    showToast('请输入基金代码')
    return
  }

  if (!/^\d{6}$/.test(code)) {
    showToast('基金代码为6位数字')
    return
  }

  const success = addFundToCategory(settingsState.currentTab, code)

  if (success) {
    showToast('添加成功')
    input.value = ''
    loadSettingsData()
    loadData()
  } else {
    showToast('添加失败或已存在')
  }
}

function deleteFund(index) {
  const code = settingsState.currentFunds[index]

  if (confirm(`确定要删除基金 ${code} 吗？`)) {
    const success = removeFundFromCategory(settingsState.currentTab, code)

    if (success) {
      showToast('删除成功')
      loadSettingsData()
      loadData()
    }
  }
}

function resetToDefault() {
  if (confirm('确定要恢复默认基金列表吗？')) {
    const success = resetCategories()

    if (success) {
      showToast('已重置')
      loadSettingsData()
      loadData()
    }
  }
}

function showToast(message) {
  const toast = document.getElementById('toast')
  const toastMessage = document.getElementById('toastMessage')
  toastMessage.textContent = message
  toast.classList.add('show')

  setTimeout(() => {
    toast.classList.remove('show')
  }, 2000)
}

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', refreshData)
  document.getElementById('settingsBtn').addEventListener('click', openSettings)
  document.getElementById('closeDetail').addEventListener('click', closeDetail)
  document.getElementById('closeSettings').addEventListener('click', closeSettings)
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeDetail()
  })
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettings()
  })
  document.getElementById('addFundBtn').addEventListener('click', addFund)
  document.getElementById('resetBtn').addEventListener('click', resetToDefault)

  document.getElementById('newFundCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addFund()
  })
}

function setupPullToRefresh() {
  let startY = 0
  let currentY = 0
  let isPulling = false
  const content = document.getElementById('fundTable')

  content.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY
    isPulling = true
  })

  content.addEventListener('touchmove', (e) => {
    if (!isPulling) return
    currentY = e.touches[0].clientY

    if (content.scrollTop === 0 && currentY - startY > 50) {
      e.preventDefault()
    }
  })

  content.addEventListener('touchend', (e) => {
    if (!isPulling) return
    isPulling = false

    if (content.scrollTop === 0 && currentY - startY > 100) {
      refreshData()
    }

    startY = 0
    currentY = 0
  })
}

function render() {
  document.getElementById('updateTime').textContent = `更新时间: ${state.updateTime}`

  const refreshIcon = document.getElementById('refreshIcon')
  if (state.loading) {
    refreshIcon.classList.add('spinning')
  } else {
    refreshIcon.classList.remove('spinning')
  }

  const tabsContainer = document.getElementById('categoryTabs')
  tabsContainer.innerHTML = state.categoryList.map(item => `
    <div class="tab-item ${state.currentTab === item.key ? 'active' : ''}"
         data-key="${item.key}"
         onclick="switchTab('${item.key}')">
      ${item.name}
    </div>
  `).join('')

  const tableBody = document.getElementById('tableBody')

  if (state.loading && state.currentData.length === 0) {
    tableBody.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>
    `
  } else if (state.currentData.length === 0) {
    tableBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">暂无数据，请点击刷新</div>
      </div>
    `
  } else {
    tableBody.innerHTML = state.currentData.map(item => `
      <div class="table-row" onclick="showDetail(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <div class="td code">${item.code}</div>
        <div class="td name">${item.name}</div>
        <div class="td nav">${item.navStr}</div>
        <div class="td price">${item.priceStr}</div>
        <div class="td premium ${item.premium >= 0 ? 'up' : 'down'}">${item.premiumText}</div>
        <div class="td status ${item.status === '暂停申购' ? 'paused' : ''}">${item.status || '--'}</div>
        <div class="td limit">${item.limit}</div>
      </div>
    `).join('')
  }
}

function renderSettings() {
  const settingsTabs = document.getElementById('settingsTabs')
  settingsTabs.innerHTML = settingsState.categoryList.map(item => `
    <div class="settings-tab ${settingsState.currentTab === item.key ? 'active' : ''}"
         data-key="${item.key}"
         onclick="switchSettingsTab('${item.key}')">
      ${item.name}
    </div>
  `).join('')

  const fundList = document.getElementById('fundList')
  fundList.innerHTML = settingsState.currentFunds.map((code, index) => `
    <div class="fund-item">
      <span class="fund-code">${code}</span>
      <button class="delete-btn" onclick="deleteFund(${index})">删除</button>
    </div>
  `).join('')
}
