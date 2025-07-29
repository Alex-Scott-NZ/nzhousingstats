import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const oauth = OAuth({
  consumer: {
    key: process.env.TRADEME_CONSUMER_KEY,
    secret: process.env.TRADEME_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  },
});

// const BASE_URL = 'https://api.trademe.co.nz/v1';
const BASE_URL = 'https://api.tmsandbox.co.nz/v1';

export async function fetchProperties(options = {}) {
  const {
    region = '', // e.g., 'auckland'
    district = '',
    suburb = '',
    price_min = '',
    price_max = '',
    bedrooms_min = '',
    bedrooms_max = '',
    rows = 500, // max results per page
    page = 1
  } = options;

  // Build query parameters
  const params = new URLSearchParams({
    ...(region && { region }),
    ...(district && { district }),  
    ...(suburb && { suburb }),
    ...(price_min && { price_min }),
    ...(price_max && { price_max }),
    ...(bedrooms_min && { bedrooms_min }),
    ...(bedrooms_max && { bedrooms_max }),
    rows: rows.toString(),
    page: page.toString(),
  });

  const url = `${BASE_URL}/Search/Property/Residential.json?${params}`;
  
  console.log('🔍 Fetching from:', url);

  try {
    const requestData = {
      url,
      method: 'GET',
    };

    const headers = oauth.toHeader(oauth.authorize(requestData));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TradeMe API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ TradeMe API Error:', error);
    throw error;
  }
}

export async function getPropertyDetails(listingId) {
  const url = `${BASE_URL}/Listings/${listingId}.json`;
  
  try {
    const requestData = { url, method: 'GET' };
    const headers = oauth.toHeader(oauth.authorize(requestData));

    const response = await fetch(url, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Property Details Error:', error);
    throw error;
  }
}