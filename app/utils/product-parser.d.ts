/**
 * Type definitions for product-parser module
 */

export interface Product {
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
}

export function isProductResponse(message: string): boolean;
export function parseProductData(message: string): Product[];
