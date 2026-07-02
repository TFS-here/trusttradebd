const axios = require('axios');
const ApiError = require('../utils/apiError');

class PathaoService {
  constructor() {
    this.baseURL = process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com'; // Sandbox or Production URL
    this.clientId = process.env.PATHAO_CLIENT_ID;
    this.clientSecret = process.env.PATHAO_CLIENT_SECRET;
    this.username = process.env.PATHAO_USERNAME;
    this.password = process.env.PATHAO_PASSWORD;
    this.storeId = process.env.PATHAO_STORE_ID;

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Retrieves an OAuth access token from Pathao.
   * Caches the token in memory until it expires.
   */
  async getAccessToken() {
    // Return cached token if valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.baseURL}/aladdin/api/v1/issue-token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        username: this.username,
        password: this.password,
        grant_type: 'password'
      });

      const data = response.data;
      this.accessToken = data.access_token;
      
      // Calculate token expiration (usually comes with expires_in field in seconds)
      const expiresIn = data.expires_in || 3600; 
      this.tokenExpiry = new Date(new Date().getTime() + (expiresIn - 60) * 1000); // 60s buffer

      return this.accessToken;
    } catch (error) {
      console.error('Pathao Auth Error:', error.response?.data || error.message);
      throw new ApiError('Failed to authenticate with Pathao API', 500);
    }
  }

  /**
   * Creates a consignment order on Pathao.
   * @param {Object} order - The TrustTrade Order object
   * @param {Object} seller - The seller's details (for pickup info, if needed)
   */
  async createConsignment(order, seller) {
    if (!this.storeId) {
      throw new ApiError('PATHAO_STORE_ID is not configured in the environment', 500);
    }

    const token = await this.getAccessToken();

    // Mapping TrustTrade Order to Pathao Payload
    // Defaulting missing fields to sensible values for Sandbox testing
    // Ensure address is at least 10 characters for Pathao validation
    const rawAddress = order.shippingAddress.address || 'Dhaka';
    const safeAddress = rawAddress.length < 10 ? rawAddress.padEnd(10, '.') : rawAddress;

    const payload = {
      store_id: parseInt(this.storeId),
      merchant_order_id: order._id.toString(),
      sender_name: seller.name || 'TrustTrade Seller',
      sender_phone: seller.phone || '01711111111',
      recipient_name: order.shippingAddress.fullName || 'Customer',
      recipient_phone: order.shippingAddress.phone || '01811111111',
      recipient_address: safeAddress,
      recipient_city: 1, // Defaulting to Dhaka city ID for Pathao
      recipient_zone: 1, // Defaulting to a specific zone ID
      recipient_area: 1, // Defaulting to a specific area ID
      delivery_type: 48, // 48 is typical Normal Delivery in Pathao
      item_type: 2, // Parcel
      special_instruction: `TrustTrade Order ID: ${order._id}`,
      item_quantity: order.items.reduce((acc, item) => acc + item.quantity, 0),
      item_weight: 0.5, // Default weight
      amount_to_collect: 0, // 0 because items are fully prepaid via SSLCommerz/Wallet
      item_description: order.items.map(i => `${i.quantity}x ${i.title}`).join(', ')
    };

    try {
      const response = await axios.post(`${this.baseURL}/aladdin/api/v1/orders`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Pathao responds with the consignment_id
      const consignmentId = response.data?.data?.consignment_id;
      if (!consignmentId) {
        throw new Error('Pathao response did not contain a consignment_id');
      }

      return consignmentId;
    } catch (error) {
      console.error('Pathao Create Order Error:', error.response?.data || error.message);
      
      let message = 'Failed to create Pathao consignment';
      if (error.response?.data) {
        const data = error.response.data;
        if (data.errors) {
          // Extract specific validation errors
          const errorDetails = Object.values(data.errors).flat().join(', ');
          message = `Pathao Validation: ${errorDetails}`;
        } else if (data.message) {
          message = data.message;
        }
      }
      throw new ApiError(message, 400);
    }
  }
}

module.exports = new PathaoService();
