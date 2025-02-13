import { NextResponse } from 'next/server';

// Generic type for successful API responses
export interface ApiSuccessResponse<T> {
  data: T;
  success: true;
}

// Generic type for error API responses
export interface ApiErrorResponse {
  error: string;
  success: false;
}

// Type guard for success responses
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

// Type guard for error responses
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.success === false;
}

// Combined response type
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Utility function for creating successful responses
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ 
    data, 
    success: true 
  }, { status });
}

// Utility function for creating error responses
export function createErrorResponse(message: string, status: number = 500): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ 
    error: message, 
    success: false 
  }, { status });
}
