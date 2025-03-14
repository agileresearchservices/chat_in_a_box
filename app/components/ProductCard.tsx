/**
 * Product Card Component
 * 
 * Displays product information in a clean, visually appealing card format.
 * Supports all enhanced e-commerce fields from the updated product schema.
 */

import React from 'react';
import Image from 'next/image';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface ProductFeature {
  icon: string;
  label: string;
}

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    brand?: string;
    model?: string;
    description?: string;
    price: number;
    discountPercentage?: number;
    originalPrice?: number;
    rating?: number;
    reviewCount?: number;
    stock?: number;
    color?: string;
    storage?: string;
    ram?: string;
    processor?: string;
    screenSize?: string | number;
    releaseYear?: number;
    category?: string;
    image?: string;
    waterResistant?: boolean | string;
    wirelessCharging?: boolean | string;
    fastCharging?: boolean | string;
    fiveGCompatible?: boolean | string;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  // Calculate the display price and discount
  const displayPrice = product.price;
  const hasDiscount = product.discountPercentage && product.discountPercentage > 0 && product.originalPrice;
  const discountAmount = hasDiscount ? Math.round(product.discountPercentage!) : 0;
  
  // Format full product title including brand and model if available
  const productTitle = [product.brand, product.model].filter(Boolean).join(' ') || product.title;
  
  // Get integer rating for star display
  const ratingValue = product.rating || 0;
  const fullStars = Math.floor(ratingValue);
  const hasHalfStar = ratingValue - fullStars >= 0.5;
  
  // Product features with icons
  const features: ProductFeature[] = [];
  
  if (product.waterResistant) {
    features.push({ icon: '💧', label: 'Water Resistant' });
  }
  
  if (product.wirelessCharging) {
    features.push({ icon: '🔄', label: 'Wireless Charging' });
  }
  
  if (product.fastCharging) {
    features.push({ icon: '⚡', label: 'Fast Charging' });
  }
  
  if (product.fiveGCompatible) {
    features.push({ icon: '📶', label: '5G Compatible' });
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
      {/* Product Image */}
      <div className="relative h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-4">
        {product.image ? (
          <Image
            src={product.image}
            alt={productTitle}
            width={200}
            height={200}
            className="object-contain h-full"
          />
        ) : (
          <div className="text-6xl">📱</div>
        )}
        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
            {discountAmount}% OFF
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{productTitle}</h3>
        
        {/* Technical Specifications */}
        <div className="mt-2 space-y-1">
          {product.storage && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="mr-2">💾</span>
              <span>Storage: {product.storage}</span>
            </div>
          )}
          {product.ram && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="mr-2">🧠</span>
              <span>RAM: {product.ram}</span>
            </div>
          )}
          {product.processor && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="mr-2">⚡</span>
              <span>Processor: {product.processor}</span>
            </div>
          )}
          {product.color && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="mr-2">🎨</span>
              <span>Color: {product.color}</span>
            </div>
          )}
        </div>

        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${displayPrice.toFixed(2)}</p>
          <div className="flex items-center mt-1">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <StarIconSolid
                  key={i}
                  className={`h-5 w-5 ${i < Math.floor(ratingValue) ? 'text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {ratingValue}/5
            </span>
          </div>
        </div>

        {product.stock !== undefined && (
          <div className="mt-2 text-sm">
            <span className={`${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>
        )}

        <button 
          disabled={!product.stock || product.stock <= 0}
          className={`mt-4 w-full py-2 px-4 rounded-md font-medium text-sm transition-colors
            ${product.stock && product.stock > 0 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
            }`}
        >
          {product.stock && product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}
