/**
 * Product Response Parser
 * 
 * Utilities for detecting and parsing product search responses
 * from the AI agent into structured data for UI rendering.
 */

import logger from '../../utils/logger';

export interface Product {
  id: string;
  title: string;
  price: number;
  brand?: string;
  model?: string;
  description?: string;
  image?: string;
  color?: string;
  storage?: string;
  ram?: string;
  processor?: string;
  rating?: number;
  reviewCount?: number;
  originalPrice?: number;
  stock?: number;
  releaseYear?: number;
  screenSize?: string | number;
  waterResistant?: boolean | string;
  wirelessCharging?: boolean | string;
  fastCharging?: boolean | string;
  fiveGCompatible?: boolean | string;
}

/**
 * Checks if the message contains a product search response
 */
export function isProductResponse(message: string): boolean {
  // Log the entire message for debugging
  logger.debug('Checking if message is a product response', { 
    messageLength: message.length,
    messagePreview: message.substring(0, 100) + '...'
  });

  // Check for the exact format pattern shown in the screenshot
  const exactFormatPattern = /I found \d+ products?:[\s\S]*?📱\s+Generic\s+Smartphone\s+💸\s+\$\d+\.\d+\s+⭐+\s+\d+\.\d+\/5\s+Storage:\s+\d+GB[\s\S]*?Color:\s+\w+[\s\S]*?RAM:\s+\d+GB[\s\S]*?Processor:/i;
  
  if (exactFormatPattern.test(message)) {
    logger.debug('Product response detected using exact format pattern');
    return true;
  }
  
  // Check if the message contains structured product data
  const productIndicators = [
    'color:', 'price:', 'storage:', 'brand:', 'processor:', 
    'ram:', 'rating:', 'techphone', 'smartphone', 'phone specs',
    'product id', 'model:', 'screen', 'battery', 'camera',
    'product details', 'product specification', 'product features',
    '📱', '💸', '⭐', '💾', '🎨', '🧠', '🔄', '📦'  // Add emoji indicators
  ];
  
  // Count how many product indicators appear in the message
  const indicatorCount = productIndicators.filter(indicator => 
    message.toLowerCase().includes(indicator.toLowerCase())
  ).length;
  
  logger.debug('Product indicators found in message', { indicatorCount });
  
  // Consider it a product response if it has at least 3 indicators
  const hasMinimumIndicators = indicatorCount >= 3;
  
  // Check for explicit JSON product data structure
  const hasJsonStructure = message.includes('"title"') && 
    (message.includes('"price"') || message.includes('"brand"') || message.includes('"color"'));
  
  // Check for the specific format pattern shown in the screenshot
  const hasProductListingFormat = /I found \d+ products?:/i.test(message);
  
  // Check for the exact emoji pattern from the screenshot
  const hasEmojiProductPattern = /📱\s+Generic\s+Smartphone\s+💸\s+\$\d+\.\d+\s+⭐+\s+\d+\.\d+\/5\s+Storage:/i.test(message);
  
  // Also check for explicit mention of products being found
  const explicitProductMention = 
    (message.toLowerCase().includes('found') || message.toLowerCase().includes('here')) && 
    (message.toLowerCase().includes('product') || 
     message.toLowerCase().includes('phone') || 
     message.toLowerCase().includes('device'));
  
  // Look for common product listing patterns
  const hasProductListingPattern = /(\d+)\s+(product|phone|device)s?\s+(found|available|matching)/i.test(message);
  
  // Force detection for messages with the specific emoji format we see in the screenshot
  const forceDetection = message.includes('📱') && 
                         message.includes('💸') && 
                         message.includes('⭐') && 
                         message.includes('Generic Smartphone');
  
  const isProduct = hasJsonStructure || hasMinimumIndicators || explicitProductMention || 
    hasProductListingPattern || hasProductListingFormat || hasEmojiProductPattern || forceDetection;
  
  logger.debug(`Message ${isProduct ? 'is' : 'is not'} a product response`, {
    exactFormatMatch: exactFormatPattern.test(message),
    indicatorCount,
    hasMinimumIndicators,
    explicitProductMention,
    hasJsonStructure,
    hasProductListingPattern,
    hasProductListingFormat,
    hasEmojiProductPattern,
    forceDetection
  });
  
  return isProduct;
}

/**
 * Parses a product search response into structured data
 */
export function parseProductData(message: string): Product[] {
  try {
    logger.debug('Attempting to parse product data from message');
    
    // Extract products data with regex patterns
    const products: Product[] = [];
    
    // First, try to find JSON-like structures
    const jsonMatch = message.match(/\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}/g);
    if (jsonMatch) {
      for (const match of jsonMatch) {
        try {
          // Try to parse as JSON
          const possibleProduct = JSON.parse(match);
          if (possibleProduct && typeof possibleProduct === 'object' && possibleProduct.id) {
            // This appears to be a product object
            products.push(possibleProduct as Product);
            logger.debug('Found product from JSON match', { productId: possibleProduct.id });
          }
        } catch (e) {
          // Not valid JSON, ignore
        }
      }
    }
    
    // If no JSON was found, try text-based parsing
    if (products.length === 0) {
      logger.debug('Starting emoji-based parsing');
      // Check for the emoji-rich format shown in the screenshot
      // This pattern matches the exact format from the screenshot
      const emojiProductPattern = /📱\s+(.*?)\s+💸\s+\$(\d+\.\d+)\s+⭐+\s+(\d+\.\d+)\/5\s+Storage:\s+(\d+GB)\s+💾\s+•\s+Color:\s+(\w+)\s+🎨\s+•\s+RAM:\s+(\d+GB)\s+🧠\s+•\s+Processor:\s+([^•]+)\s+🔄\s+•\s+Stock:\s+(\d+)\s+📦/g;
      
      let emojiMatch;
      let productId = 1;
      
      logger.debug('Message content for parsing:', { message });
      
      while ((emojiMatch = emojiProductPattern.exec(message)) !== null) {
        logger.debug('Found emoji match:', { match: emojiMatch[0] });
        const [_, title, price, rating, storage, color, ram, processor, stock] = emojiMatch;
        
        const product = {
          id: `product-${productId++}`,
          title: title.trim(),
          price: parseFloat(price),
          rating: parseFloat(rating),
          storage: storage,
          color: color,
          ram: ram,
          processor: processor.trim(),
          stock: parseInt(stock, 10),
          image: undefined // Use undefined instead of null
        };
        
        products.push(product);
        logger.debug('Parsed product:', product);
      }
      
      // If the specific emoji pattern didn't match, try a more general pattern
      if (products.length === 0) {
        // Try to match the format in the screenshot with a more flexible pattern
        const flexibleEmojiPattern = /📱\s+(.*?)\s+💸\s+\$(\d+\.\d+)\s+⭐+\s+(\d+\.\d+)\/5[\s\S]*?Storage:\s+(\d+GB)[\s\S]*?Color:\s+(\w+)[\s\S]*?RAM:\s+(\d+GB)[\s\S]*?Processor:\s+([^•\n]+)[\s\S]*?Stock:\s+(\d+)/g;
        
        let flexMatch;
        let flexProductId = 1;
        
        while ((flexMatch = flexibleEmojiPattern.exec(message)) !== null) {
          const [_, title, price, rating, storage, color, ram, processor, stock] = flexMatch;
          
          products.push({
            id: `product-${flexProductId++}`,
            title: title.trim(),
            price: parseFloat(price),
            rating: parseFloat(rating),
            storage: storage,
            color: color,
            ram: ram,
            processor: processor.trim(),
            stock: parseInt(stock, 10),
            image: undefined
          });
          
          logger.debug('Found product from flexible emoji pattern', { 
            title: title.trim(),
            price: parseFloat(price)
          });
        }
        
        // Try to match lines that look like product entries with emojis
        if (products.length === 0) {
          const productLines = message.split('\n').filter(line => 
            line.includes('📱') && 
            line.includes('$') && 
            (line.includes('Storage:') || line.includes('💾'))
          );
          
          productLines.forEach((line, index) => {
            // Extract basic product info
            const titleMatch = line.match(/📱\s+([\w\s]+)/);
            const priceMatch = line.match(/\$(\d+\.\d+)/);
            const ratingMatch = line.match(/(\d+\.\d+)\/5/);
            
            if (titleMatch && priceMatch) {
              const product: Product = {
                id: `product-${index + 1}`,
                title: titleMatch[1].trim(),
                price: parseFloat(priceMatch[1]),
                image: undefined
              };
              
              // Try to extract other attributes
              if (ratingMatch) {
                product.rating = parseFloat(ratingMatch[1]);
              }
              
              // Extract storage
              const storageMatch = line.match(/Storage:\s+(\d+GB)/);
              if (storageMatch) {
                product.storage = storageMatch[1];
              }
              
              // Extract color
              const colorMatch = line.match(/Color:\s+(\w+)/);
              if (colorMatch) {
                product.color = colorMatch[1];
              }
              
              // Extract RAM
              const ramMatch = line.match(/RAM:\s+(\d+GB)/);
              if (ramMatch) {
                product.ram = ramMatch[1];
              }
              
              // Extract processor
              const processorMatch = line.match(/Processor:\s+([^•]+)/);
              if (processorMatch) {
                product.processor = processorMatch[1].trim();
              }
              
              // Extract stock
              const stockMatch = line.match(/Stock:\s+(\d+)/);
              if (stockMatch) {
                product.stock = parseInt(stockMatch[1], 10);
              }
              
              products.push(product);
              logger.debug('Found product from line pattern', { 
                title: product.title,
                price: product.price
              });
            }
          });
        }
        
        // If emoji patterns didn't match, try the regular pattern
        if (products.length === 0) {
          // Split the message into sections that might represent individual products
          const sections = message.split(/\n\s*\n|\r\n\s*\r\n|\n\s*\r\n|\r\n\s*\n/);
          
          for (const section of sections) {
            // Check if this section looks like a product description
            if (section.includes('price:') || 
                section.includes('color:') || 
                section.includes('storage:')) {
            
              const product: Product = {
                id: Math.random().toString(36).substring(2, 15),
                title: extractValue(section, 'title') || extractValue(section, 'name') || 'Smartphone',
                price: 0 // Default price that will be overridden if found
              };
              
              // Extract product fields
              const priceStr = extractValue(section, 'price');
              if (priceStr) {
                const priceMatch = priceStr.match(/(\d+(\.\d+)?)/);
                if (priceMatch) {
                  product.price = parseFloat(priceMatch[1]);
                }
              }
              product.brand = extractValue(section, 'brand');
              product.model = extractValue(section, 'model');
              product.description = extractValue(section, 'description');
              product.color = extractValue(section, 'color');
              product.storage = extractValue(section, 'storage');
              product.ram = extractValue(section, 'ram');
              product.processor = extractValue(section, 'processor');
              
              // Parse rating if available
              const ratingStr = extractValue(section, 'rating');
              if (ratingStr) {
                const ratingMatch = ratingStr.match(/(\d+(\.\d+)?)/);
                if (ratingMatch) {
                  product.rating = parseFloat(ratingMatch[1]);
                }
              }
              
              // Handle boolean features
              product.waterResistant = extractBoolean(section, 'water resistant');
              product.wirelessCharging = extractBoolean(section, 'wireless charging');
              product.fastCharging = extractBoolean(section, 'fast charging');
              product.fiveGCompatible = extractBoolean(section, '5g');
              
              products.push(product);
              logger.debug('Found product from text parsing', { productTitle: product.title });
            }
          }
        }
      }
    }
    
    logger.info(`Successfully parsed ${products.length} products from message`);
    // Limit to 3 products for display
    return products.slice(0, 3);
  } catch (error) {
    logger.error('Error parsing product data', { error: String(error) });
    return [];
  }
}

/**
 * Helper function to extract a value for a specific field from text
 */
function extractValue(text: string, field: string): string | undefined {
  const regex = new RegExp(`${field}\\s*[:=]\\s*([^,\\n\\r]+)`, 'i');
  const match = text.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Helper function to extract boolean values from text
 */
function extractBoolean(text: string, field: string): boolean {
  const lowercaseText = text.toLowerCase();
  return lowercaseText.includes(field) && 
         !lowercaseText.includes(`no ${field}`) && 
         !lowercaseText.includes(`not ${field}`);
}
