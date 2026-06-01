const https = require('https');

exports.handler = async (event, context) => {
    const code = event.queryStringParameters.code;

    if (!code) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: '请提供基金代码'
            })
        };
    }

    const apiUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;

    return new Promise((resolve, reject) => {
        const req = https.get(apiUrl, {
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
                try {
                    const buffer = Buffer.concat(chunks);
                    let dataStr;

                    try {
                        const decoder = new TextDecoder('gbk');
                        dataStr = decoder.decode(buffer);
                    } catch (e) {
                        dataStr = buffer.toString('gbk');
                    }

                    const nameMatch = dataStr.match(/fS_name\s*=\s*"(.*?)"/);
                    const name = nameMatch ? nameMatch[1] : '';

                    const netWorthMatch = dataStr.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
                    
                    if (netWorthMatch) {
                        try {
                            const navData = JSON.parse(netWorthMatch[1]);
                            if (navData && navData.length > 0) {
                                const latestNav = parseFloat(navData[navData.length - 1].y);
                                const latestDate = new Date(navData[navData.length - 1].x);

                                if (!isNaN(latestNav) && latestNav > 0) {
                                    const jzrq = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-${String(latestDate.getDate()).padStart(2, '0')}`;
                                    resolve({
                                        statusCode: 200,
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Access-Control-Allow-Origin': '*'
                                        },
                                        body: JSON.stringify({
                                            success: true,
                                            name: name,
                                            nav: latestNav,
                                            jzrq: jzrq
                                        })
                                    });
                                    return;
                                }
                            }
                        } catch (parseError) {
                            console.error('JSON解析错误:', parseError);
                        }
                    }

                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: false,
                            error: '未找到该基金或数据不存在'
                        })
                    });
                } catch (error) {
                    resolve({
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: false,
                            error: `解析数据失败: ${error.message}`
                        })
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: `网络错误: ${error.message}`
                })
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                statusCode: 504,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: '请求超时'
                })
            });
        });
    });
};
