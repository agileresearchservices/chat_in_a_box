'use client'

import React from 'react';
import { StoreData, StoreResponse } from '@/utils/store-parser';
import { BuildingStorefrontIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';

/**
 * Store Card Props Interface
 * 
 * @interface StoreCardProps
 * @property {StoreResponse} data - The store data to display in the card
 */
interface StoreCardProps {
  data: StoreResponse;
}

/**
 * Store Card Component
 * 
 * Displays store location information in a visually appealing card format.
 * 
 * @param {StoreCardProps} props - Component props containing store data
 * @returns {JSX.Element} The rendered store card component
 */
const StoreCard: React.FC<StoreCardProps> = ({ data }) => {
  if (data.isError) {
    return (
      <div className="w-full max-w-2xl p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <BuildingStorefrontIcon className="h-6 w-6 text-red-500" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Store Locator</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{data.errorMessage || "No stores found matching your criteria."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl p-4 bg-white shadow-md rounded-lg overflow-hidden">
      <div className="border-b pb-3 mb-3">
        <h3 className="text-lg font-medium text-gray-900">
          <BuildingStorefrontIcon className="inline h-5 w-5 mr-2 text-blue-500" />
          Stores {data.location ? `in ${data.location}` : ''} ({data.total} found)
        </h3>
      </div>
      
      <div className="overflow-y-auto max-h-[400px]">
        {data.stores.map((store, index) => (
          <div key={index} className={`pb-3 ${index !== data.stores.length - 1 ? 'border-b mb-3' : ''}`}>
            <h4 className="text-md font-semibold">{store.storeName}</h4>
            <p className="text-xs text-gray-500">Store #{store.storeNumber}</p>
            
            <div className="mt-2 flex items-start">
              <MapPinIcon className="h-5 w-5 text-gray-500 mr-1 flex-shrink-0" />
              <p className="text-sm">
                {store.address}, {store.city}, {store.state} {store.zipCode}
              </p>
            </div>
            
            <div className="mt-1 flex items-center">
              <PhoneIcon className="h-5 w-5 text-gray-500 mr-1" />
              <p className="text-sm">{store.phoneNumber}</p>
            </div>
          </div>
        ))}
      </div>
      
      {data.total > data.stores.length && (
        <div className="mt-3 pt-3 border-t text-sm text-gray-500 text-center">
          Showing {data.stores.length} of {data.total} total stores
        </div>
      )}
    </div>
  );
};

export default StoreCard;
