const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('======================================');
console.log('🔍 Netlify Functions 本地测试');
console.log('======================================\n');

const fundCode = '501312';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n测试: ${name}`);
  console.log(`URL: ${url}`);
  console.log('-'.repeat(50));

  const startTime = Date.now();

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'Referer': 'https://fund.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const elapsed = Date.now() - startTime;

        try {
          const buffer = Buffer.concat(chunks);
          let dataStr;

          try {
            const decoder = new TextDecoder('gbk');
            dataStr = decoder.decode(buffer);
          } catch (e) {
            dataStr = buffer.toString('utf-8');
          }

          console.log(`✅ HTTP ${res.statusCode} | 耗时: ${elapsed}ms`);
          console.log(`数据长度: ${dataStr.length} 字节`);
          console.log(`数据预览: ${dataStr.substring(0, 200)}...`);

          resolve({ success: true, data: dataStr, elapsed, statusCode: res.statusCode });
        } catch (error) {
          console.log(`❌ 解析失败: ${error.message}`);
          resolve({ success: false, error: error.message, elapsed, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      console.log(`❌ 网络错误: ${error.message} | 耗时: ${elapsed}ms`);
      resolve({ success: false, error: error.message, elapsed });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log(`❌ 请求超时`);
      resolve({ success: false, error: 'timeout', elapsed: 10000 });
    });
  });
}

async function testFundAPI() {
  console.log('\n\n======================================');
  console.log('📊 测试 1: 天天基金净值 API');
  console.log('======================================');

  const apiUrl = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;
  return await testEndpoint('天天基金净值', apiUrl);
}

async function testTencentAPI() {
  console.log('\n\n======================================');
  console.log('📊 测试 2: 腾讯股票价格 API');
  console.log('======================================');

  const marketCode = fundCode.startsWith('5') ? `sh${fundCode}` : `sz${fundCode}`;
  const apiUrl = `https://qt.gtimg.cn/q=${marketCode}`;
  return await testEndpoint('腾讯股票价格', apiUrl);
}

async function testPingzhongAPI() {
  console.log('\n\n======================================');
  console.log('📊 测试 3: 东财平层 API');
  console.log('======================================');

  const apiUrl = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`;
  return await testEndpoint('东财平层', apiUrl);
}

async function testFundInfoAPI() {
  console.log('\n\n======================================');
  console.log('📊 测试 4: 东财基金信息 API');
  console.log('======================================');

  const apiUrl = `https://fundf10.eastmoney.com/jjfl_${fundCode}.html`;
  return await testEndpoint('东财基金信息', apiUrl);
}

async function parseFundData(dataStr) {
  console.log('\n\n======================================');
  console.log('📋 数据解析测试');
  console.log('======================================\n');

  try {
    const jsonMatch = dataStr.match(/jsonpgz\(([\s\S]*)\)/);

    if (jsonMatch && jsonMatch[1]) {
      const jsonStr = jsonMatch[1].trim();
      const fundData = JSON.parse(jsonStr);

      console.log('✅ JSON 解析成功!');
      console.log('\n基金数据:');
      console.log(`  基金代码: ${fundData.fundcode}`);
      console.log(`  基金名称: ${fundData.name}`);
      console.log(`  当前净值: ${fundData.dwjz}`);
      console.log(`  估算净值: ${fundData.gsz}`);
      console.log(`  估算时间: ${fundData.gztime}`);
      console.log(`  净值日期: ${fundData.jzrq}`);

      return { success: true, data: fundData };
    } else {
      console.log('❌ 无法匹配 JSON 数据');
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ 解析错误: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testPingzhongParse(dataStr) {
  console.log('\n\n======================================');
  console.log('📋 东财平层数据解析测试');
  console.log('======================================\n');

  try {
    const nameMatch = dataStr.match(/fS_name\s*=\s*"(.*?)"/);
    const name = nameMatch ? nameMatch[1] : '';
    console.log(`基金名称: ${name}`);

    const netWorthMatch = dataStr.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);

    if (netWorthMatch) {
      try {
        const navData = JSON.parse(netWorthMatch[1]);
        if (navData && navData.length > 0) {
          const latestNav = parseFloat(navData[navData.length - 1].y);
          const latestDate = new Date(navData[navData.length - 1].x);

          const jzrq = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-${String(latestDate.getDate()).padStart(2, '0')}`;

          console.log(`✅ 解析成功!`);
          console.log(`  最新净值: ${latestNav}`);
          console.log(`  净值日期: ${jzrq}`);

          return { success: true, name, nav: latestNav, jzrq };
        }
      } catch (parseError) {
        console.log(`❌ JSON 解析错误: ${parseError.message}`);
        return { success: false, error: parseError.message };
      }
    }

    console.log('❌ 未找到净值数据');
    return { success: false };
  } catch (error) {
    console.log(`❌ 解析错误: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n🚀 开始运行所有测试...\n');
  console.log(`测试基金代码: ${fundCode}`);
  console.log(`测试时间: ${new Date().toLocaleString()}\n`);

  const results = {};

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('               📡 API 连通性测试');
  console.log('='.repeat(60));

  results.fund = await testFundAPI();
  await new Promise(resolve => setTimeout(resolve, 500));

  results.tencent = await testTencentAPI();
  await new Promise(resolve => setTimeout(resolve, 500));

  results.pingzhong = await testPingzhongAPI();
  await new Promise(resolve => setTimeout(resolve, 500));

  results.fundinfo = await testFundInfoAPI();

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('               📊 测试结果汇总');
  console.log('='.repeat(60));

  console.log('\nAPI 连通性:');
  console.log(`  天天基金净值: ${results.fund.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  腾讯股票价格: ${results.tencent.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  东财平层:     ${results.pingzhong.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  东财基金信息: ${results.fundinfo.success ? '✅ 成功' : '❌ 失败'}`);

  if (results.fund.success) {
    await parseFundData(results.fund.data);
  }

  if (results.pingzhong.success) {
    await testPingzhongParse(results.pingzhong.data);
  }

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('               🎉 测试完成');
  console.log('='.repeat(60));

  console.log('\n📝 说明:');
  console.log('  1. 以上测试直接连接外部 API，不经过 Netlify');
  console.log('  2. 如果所有 API 都成功，说明外部服务正常');
  console.log('  3. 在 Netlify 上运行时，会通过 Functions 代理这些请求');
  console.log('  4. CORS 问题将在 Netlify 环境中自动解决\n');
}

runAllTests().catch(console.error);
