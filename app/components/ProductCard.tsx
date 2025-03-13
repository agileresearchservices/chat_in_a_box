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
    screenSize?: string;
    releaseYear?: number;
    category?: string;
    image?: string;
    waterResistant?: boolean;
    wirelessCharging?: boolean;
    fastCharging?: boolean;
    fiveGCompatible?: boolean;
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
        
        {/* Stock Status */}
        <div className={`absolute bottom-2 right-2 text-xs font-semibold px-2 py-1 rounded-md ${
          product.stock && product.stock > 0 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {product.stock && product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
        </div>
      </div>
      
      {/* Product Info */}
      <div className="p-4">
        {/* Title & Brand */}
        <div className="mb-2">
          {product.brand && (
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {product.brand}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {productTitle}
          </h3>
        </div>
        
        {/* Rating */}
        {product.rating !== undefined && (
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                i < fullStars ? (
                  <StarIconSolid key={i} className="h-4 w-4 text-yellow-400" />
                ) : i === fullStars && hasHalfStar ? (
                  <div key={i} className="relative h-4 w-4">
                    <StarIconOutline className="absolute h-4 w-4 text-yellow-400" />
                    <div className="absolute overflow-hidden w-2 h-4">
                      <StarIconSolid className="h-4 w-4 text-yellow-400" />
                    </div>
                  </div>
                ) : (
                  <StarIconOutline key={i} className="h-4 w-4 text-yellow-400" />
                )
              ))}
            </div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {ratingValue.toFixed(1)}
              {product.reviewCount && (
                <span className="ml-1">({product.reviewCount} reviews)</span>
              )}
            </span>
          </div>
        )}
        
        {/* Price */}
        <div className="flex items-center mb-3">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            ${displayPrice.toFixed(2)}
          </span>
          
          {hasDiscount && product.originalPrice && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
        
        {/* Specs */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
          {product.storage && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">💾</span> {product.storage}
            </div>
          )}
          
          {product.color && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">🎨</span> {product.color}
            </div>
          )}
          
          {product.ram && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">🧠</span> {product.ram}
            </div>
          )}
          
          {product.processor && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">🔄</span> {product.processor}
            </div>
          )}
          
          {product.screenSize && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">📱</span> {product.screenSize}&quot;
            </div>
          )}
          
          {product.releaseYear && (
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-1">📅</span> {product.releaseYear}
            </div>
          )}
        </div>
        
        {/* Features */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {features.map((feature, index) => (
              <span 
                key={index} 
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                <span className="mr-1">{feature.icon}</span> {feature.label}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Call to Action */}
      <div className="px-4 pb-4">
        <button 
          disabled={!product.stock || product.stock <= 0}
          className={`w-full py-2 px-4 rounded-md font-medium text-sm transition-colors
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
