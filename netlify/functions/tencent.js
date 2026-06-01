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

    const marketCode = code.startsWith('5') ? `sh${code}` : `sz${code}`;
    const apiUrl = `https://qt.gtimg.cn/q=${marketCode}`;

    return new Promise((resolve, reject) => {
        const req = https.get(apiUrl, (res) => {
            const chunks = [];

            res.on('data', (chunk) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const dataStr = buffer.toString('utf-8');
                    
                    const match = dataStr.match(/=\"(.*)\"/);
                    if (match && match[1]) {
                        const parts = match[1].split('~');
                        if (parts.length > 40) {
                            const price = parseFloat(parts[3]);
                            if (!isNaN(price) && price > 0) {
                                resolve({
                                    statusCode: 200,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Access-Control-Allow-Origin': '*'
                                    },
                                    body: JSON.stringify({
                                        success: true,
                                        name: parts[1] || '',
                                        code: parts[2] || '',
                                        price: price,
                                        volume: parts[38] || '--',
                                        yesterdayClose: parseFloat(parts[4]) || 0,
                                        open: parseFloat(parts[5]) || 0,
                                        date: parts[30] || '',
                                        time: parts[31] || ''
                                    })
                                });
                                return;
                            }
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
