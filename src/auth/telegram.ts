import crypto from 'crypto';

export function validateWebAppData(initData: string, botToken: string): boolean {
    if (!initData) return false;

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) return false;

    urlParams.delete('hash');

    const keys = Array.from(urlParams.keys());
    keys.sort();

    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    const _hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return _hash === hash;
}
