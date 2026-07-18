'use strict';

/**
 * Known mobile device brands / keywords.
 * A device name must contain at least one of these (case-insensitive)
 * to be considered a real phone.
 */
const BRANDS = [
    'samsung', 'galaxy',
    'iphone', 'ipad', 'apple',
    'poco', 'xiaomi', 'redmi', 'mi ',
    'oneplus',
    'oppo', 'reno', 'find x',
    'vivo', 'iqoo',
    'realme',
    'huawei', 'honor',
    'motorola', 'moto ',
    'nokia',
    'sony', 'xperia',
    'google', 'pixel',
    'asus', 'rog phone', 'zenfone',
    'tecno', 'camon', 'spark',
    'infinix', 'hot ', 'note ',
    'itel',
    'zte', 'nubia', 'axon',
    'lg ', ' lg',
    'lenovo',
    'blackberry',
    'htc',
    'alcatel',
    'micromax',
    'lava ',
    'umidigi',
    'oukitel',
    'doogee',
    'cubot',
    'ulefone',
    'blackview',
    'nothing phone',
    'fairphone',
    'cat phone', 'cat s',
    'agm ',
    'meizu',
    'wiko',
];

/**
 * Returns true if the device name contains at least one known brand keyword.
 * @param {string} name
 */
function isKnownBrand(name) {
    const lower = name.toLowerCase();
    return BRANDS.some(b => lower.includes(b));
}

module.exports = { isKnownBrand };
