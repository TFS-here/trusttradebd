const Product = require('../models/Product.model');
const ApiError = require('../utils/apiError');

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Parses and validates query params for listing/filtering products.
 * Centralised here so both getProducts and searchProducts use the same logic.
 */
const buildProductQuery = (query) => {
  const filter = { isBanned: false };
  const {
    category,
    minPrice,
    maxPrice,
    inStock,
    search,
    sellerId,
    includeInactive, // only sellers/admins use this
  } = query;

  // By default only show active listings
  if (includeInactive !== 'true') {
    filter.isActive = true;
  }

  if (category) filter.category = category;
  if (sellerId) filter.seller = sellerId;

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  // inStock=true → only products with stock > 0
  if (inStock === 'true') filter.stock = { $gt: 0 };

  // Full-text search using the text index on title/description/tags
  let textSearch = null;
  if (search && search.trim()) {
    textSearch = { $text: { $search: search.trim() } };
  }

  return { filter: { ...filter, ...textSearch }, hasTextSearch: !!textSearch };
};

// ── Controllers ───────────────────────────────────────────────────

/**
 * POST /api/products
 * Seller only — create a new product listing.
 */
const createProduct = async (req, res, next) => {
  try {
    const { title, description, price, stock, category, images, tags } = req.body;

    // Basic validation
    const errors = [];
    if (!title?.trim()) errors.push({ field: 'title', message: 'Title is required.' });
    if (!description?.trim()) errors.push({ field: 'description', message: 'Description is required.' });
    if (!price || isNaN(price) || Number(price) <= 0)
      errors.push({ field: 'price', message: 'Price must be a positive number.' });
    if (stock === undefined || isNaN(stock) || Number(stock) < 0)
      errors.push({ field: 'stock', message: 'Stock must be 0 or greater.' });
    if (!category) errors.push({ field: 'category', message: 'Category is required.' });

    if (errors.length > 0) return next(ApiError.badRequest('Validation failed.', errors));

    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(Number(price).toFixed(2)),
      stock: parseInt(stock, 10),
      category,
      images: Array.isArray(images) ? images : [],
      tags: Array.isArray(tags) ? tags : [],
      seller: req.user._id,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Product created successfully.',
      data: { product },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products
 * Public — paginated product listing with filters.
 */
const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Sort options
    const SORT_MAP = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1 },
      popular: { reviewCount: -1 },
    };
    const sort = SORT_MAP[req.query.sort] || SORT_MAP.newest;

    const { filter, hasTextSearch } = buildProductQuery(req.query);

    // If text search, add relevance score sort
    const finalSort = hasTextSearch ? { score: { $meta: 'textScore' }, ...sort } : sort;
    const projection = hasTextSearch ? { score: { $meta: 'textScore' } } : {};

    const [products, total] = await Promise.all([
      Product.find(filter, projection)
        .sort(finalSort)
        .skip(skip)
        .limit(limit)
        .populate('seller', 'name sellerProfile.shopName avatar'),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Public — get a single product with seller info.
 */
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isBanned: false,
    }).populate('seller', 'name avatar sellerProfile createdAt');

    if (!product) return next(ApiError.notFound('Product'));

    // Don't expose inactive products to the public
    // (sellers can still see their own via getMyProducts)
    if (!product.isActive && req.user?._id?.toString() !== product.seller._id.toString()) {
      return next(ApiError.notFound('Product'));
    }

    // Related products: same category, exclude this product
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      isBanned: false,
    })
      .sort({ rating: -1 })
      .limit(6)
      .select('title price images rating reviewCount stock isActive');

    return res.status(200).json({
      status: 'success',
      data: { product, related },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/products/:id
 * Seller (own product) or Admin — update product details.
 * Stock and price are updated here; stock reduction on purchase
 * goes through the Order system (Product.decrementStock).
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(ApiError.notFound('Product'));

    // Sellers can only edit their own products
    const isSeller = req.user.role === 'seller';
    const isOwner = product.seller.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (isSeller && !isOwner) {
      return next(ApiError.forbidden('You can only edit your own products.'));
    }
    if (!isSeller && !isAdmin) {
      return next(ApiError.forbidden('Sellers or admins only.'));
    }

    const allowed = ['title', 'description', 'price', 'stock', 'category', 'images', 'tags', 'isActive'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Validate price if being updated
    if (updates.price !== undefined) {
      if (isNaN(updates.price) || Number(updates.price) <= 0) {
        return next(ApiError.badRequest('Price must be a positive number.'));
      }
      updates.price = parseFloat(Number(updates.price).toFixed(2));
    }

    // Validate stock if being updated
    if (updates.stock !== undefined) {
      if (isNaN(updates.stock) || Number(updates.stock) < 0) {
        return next(ApiError.badRequest('Stock must be 0 or greater.'));
      }
      updates.stock = parseInt(updates.stock, 10);

      // If seller restocks a previously sold-out product, reactivate it
      if (updates.stock > 0 && !product.isActive && product.hasSold) {
        updates.isActive = true;
      }
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('seller', 'name avatar');

    return res.status(200).json({
      status: 'success',
      message: 'Product updated successfully.',
      data: { product: updated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id
 * Seller (own) or Admin — soft delete only.
 * Products with orders (hasSold=true) are deactivated, never removed.
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(ApiError.notFound('Product'));

    const isOwner = product.seller.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return next(ApiError.forbidden('You can only delete your own products.'));
    }

    if (product.hasSold) {
      // Has purchase history → soft delete (deactivate only)
      await Product.findByIdAndUpdate(req.params.id, { isActive: false });
      return res.status(200).json({
        status: 'success',
        message: 'Product deactivated. It cannot be fully deleted because it has purchase history.',
        data: { softDeleted: true },
      });
    }

    // No purchases → safe to hard delete
    await Product.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      status: 'success',
      message: 'Product deleted permanently.',
      data: { softDeleted: false },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/my-products
 * Seller only — get all their own products including inactive ones.
 */
const getMyProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { seller: req.user._id };

    // Optional status filter from seller dashboard
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;
    if (req.query.status === 'out_of_stock') filter.stock = 0;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        products,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/products/:id/restock
 * Seller (own) only — convenience endpoint to add stock quantity.
 * Separate from updateProduct to keep restock UX simple.
 */
const restockProduct = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || isNaN(quantity) || parseInt(quantity, 10) < 1) {
      return next(ApiError.badRequest('Quantity must be a positive integer.'));
    }

    const product = await Product.findById(req.params.id);
    if (!product) return next(ApiError.notFound('Product'));

    const isOwner = product.seller.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return next(ApiError.forbidden('You can only restock your own products.'));
    }

    const addQty = parseInt(quantity, 10);
    const newStock = product.stock + addQty;

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      {
        stock: newStock,
        // Reactivate if it was deactivated due to zero stock
        ...(newStock > 0 && !product.isActive ? { isActive: true } : {}),
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Added ${addQty} units. New stock: ${updated.stock}.`,
      data: { product: updated },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  restockProduct,
};
