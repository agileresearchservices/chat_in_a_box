/**
 * This module provides utilities for handling Tailwind CSS class names.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class names into a single string using `clsx` and merges them with Tailwind's utility classes.
 *
 * @param {...ClassValue[]} inputs - A variable number of class name values to combine and merge.
 * 
 * This function accepts any number of arguments, each representing class names or arrays of class names. It uses
 * the `clsx` library to concatenate these into a single string of class names, then utilizes `twMerge` from
 * 'tailwind-merge' to intelligently handle overlapping Tailwind classes by keeping only one instance of each class.
 *
 * @returns {string} - A merged and deduplicated string of class names suitable for use in JSX or HTML elements.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
