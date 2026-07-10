import axios from 'axios';

async function testVanyy() {
    const videoUrl = 'https://www.youtube.com/shorts/p4v1gN2q154';
    const api = 'https://api.vanyydownloader.com/api/v1/';
    console.log(`Testing POST to ${api} with url: ${videoUrl}`);

    try {
        const response = await axios.post(api, {
            url: videoUrl
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        console.log('Vanyy Response Status:', response.status);
        console.log('Vanyy Response Data:', response.data);
    } catch (err) {
        console.error('Vanyy Failed:', err.response ? err.response.data : err.message);
    }
}

testVanyy();
