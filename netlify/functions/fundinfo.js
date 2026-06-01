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

    const apiUrl = `https://fundf10.eastmoney.com/jjfl_${code}.html`;

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

                    const sgStatusMatch = dataStr.match(/交易状态[：:]\s*([^\s\n（]+)/);
                    const sgStatus = sgStatusMatch ? sgStatusMatch[1].trim() : '';

                    let status = '';
                    let limit = '--';

                    if (sgStatus.includes('暂停')) {
                        status = '暂停申购';
                    } else if (sgStatus.includes('限大额')) {
                        status = '限大额';
                        const limitMatch = dataStr.match(/日累计申购限额[\s\S]*?(\d[\d,]*\.?\d*)\s*元/);
                        if (limitMatch && limitMatch[1]) {
                            const numStr = limitMatch[1].replace(/,/g, '');
                            const limitNum = parseFloat(numStr);
                            if (!isNaN(limitNum) && limitNum > 0) {
                                if (limitNum >= 100000000) {
                                    limit = (limitNum / 100000000).toFixed(0) + '亿';
                                } else if (limitNum >= 10000) {
                                    limit = (limitNum / 10000).toFixed(0) + '万';
                                } else {
                                    limit = limitNum.toFixed(0);
                                }
                            }
                        }
                    } else if (sgStatus.includes('封闭')) {
                        status = '封闭期';
                    } else if (sgStatus.includes('开放')) {
                        status = '开放申购';
                    }

                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: true,
                            status: status,
                            limit: limit,
                            rawStatus: sgStatus
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
