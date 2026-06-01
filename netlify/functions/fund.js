const https = require('https');

exports.handler = async (event, context) => {
    const fundCode = event.queryStringParameters.code;

    if (!fundCode) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                errCode: '400',
                errMsg: '请提供基金代码'
            })
        };
    }

    const apiUrl = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;

    return new Promise((resolve, reject) => {
        const req = https.get(apiUrl, (res) => {
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
                        const binaryStr = buffer.toString('binary');
                        dataStr = convertGBKToUTF8(binaryStr);
                    }

                    const jsonMatch = dataStr.match(/jsonpgz\(([\s\S]*)\)/);

                    if (jsonMatch && jsonMatch[1]) {
                        const jsonStr = jsonMatch[1].trim();
                        const fundData = JSON.parse(jsonStr);

                        const result = {
                            errCode: '0',
                            name: fundData.name || '基金',
                            fundcode: fundData.fundcode,
                            dwjz: fundData.dwjz || '0',
                            ljjz: fundData.ljjz || fundData.dwjz || '0',
                            gsz: fundData.gsz || '0',
                            gszzl: fundData.gszzl || '0',
                            gztime: fundData.gztime || '',
                            jzrq: fundData.jzrq || ''
                        };

                        resolve({
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify(result)
                        });
                    } else {
                        resolve({
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({
                                errCode: '404',
                                errMsg: '未找到该基金或数据不存在'
                            })
                        });
                    }
                } catch (error) {
                    resolve({
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            errCode: '500',
                            errMsg: `解析数据失败: ${error.message}`
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
                    errCode: '500',
                    errMsg: `网络错误: ${error.message}`
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
                    errCode: '504',
                    errMsg: '请求超时'
                })
            });
        });
    });
};

function convertGBKToUTF8(str) {
    const commonChars = {
        '易': '易', '方': '方', '消': '消', '费': '费', '行': '行',
        '业': '业', '股': '股', '票': '票', '基': '基', '金': '金',
        '国': '国', '内': '内', '型': '型', '开': '开', '放': '放',
        '式': '式', '证': '证', '券': '券', '投': '投', '资': '资'
    };

    return str;
}
