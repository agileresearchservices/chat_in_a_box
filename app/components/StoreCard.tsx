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
      <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-lg shadow-md overflow-hidden max-w-2xl mx-auto">
        {/* Error Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white">
          <h2 className="text-xl font-semibold">Store Locator</h2>
          <div className="text-sm opacity-90">Location Search</div>
        </div>
        
        {/* Error Content */}
        <div className="p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <BuildingStorefrontIcon className="h-10 w-10 text-orange-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <div className="text-lg font-medium text-red-700">Unable to Find Stores</div>
              <div className="mt-2 text-sm text-gray-600">
                <p>{data.errorMessage || "No stores found matching your criteria."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-md overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-500 p-4 text-white">
        <h2 className="text-xl font-semibold flex items-center">
          <BuildingStorefrontIcon className="inline h-5 w-5 mr-2" />
          {data.location ? `Stores in ${data.location}` : 'Store Locations'}
        </h2>
        <div className="text-sm opacity-90">{data.total} locations found</div>
      </div>
      
      {/* Store Content */}
      <div className="p-5">
        <div className="overflow-y-auto max-h-[400px]">
          {data.stores.map((store, index) => (
            <div key={index} className={`p-3 ${index !== data.stores.length - 1 ? 'border-b mb-3' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-md font-semibold text-indigo-800">{store.storeName}</h4>
                  <p className="text-xs text-gray-500">Store #{store.storeNumber}</p>
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-white bg-opacity-60 rounded-lg">
                <div className="flex items-start mb-2">
                  <MapPinIcon className="h-5 w-5 text-indigo-500 mr-1 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    {store.address}, {store.city}, {store.state} {store.zipCode}
                  </p>
                </div>
                
                <div className="flex items-center">
                  <PhoneIcon className="h-5 w-5 text-indigo-500 mr-1" />
                  <p className="text-sm text-gray-700">{store.phoneNumber}</p>
                </div>
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
    </div>
  );
};

export default StoreCard;
