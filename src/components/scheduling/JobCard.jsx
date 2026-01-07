import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUp, Construction, ArrowLeft, Truck, CheckCircle2, Package } from 'lucide-react';

export default function JobCard({ job, deliveryTypes }) {
  const deliveryType = deliveryTypes?.find(dt => dt.id === job.deliveryTypeId);
  const isUnitDelivery = deliveryType?.code && ['UNITUP', 'UNITDWN', 'CRANE'].includes(deliveryType.code);
  const isUnitUp = deliveryType?.code === 'UNITUP';
  const isCrane = deliveryType?.code === 'CRANE';
  const isReturned = job.status === 'RETURNED' || job.isReturned;
  
  const hasNonStandard = job.nonStandardDelivery && Object.entries(job.nonStandardDelivery).some(([key, value]) => {
    if (key === 'longWalkDistance' || key === 'stairsCount' || key === 'otherDetails') return false;
    return value === true;
  });

  let bgClass = 'bg-white';
  let borderClass = 'border-gray-300';
  
  // Returned jobs are always black
  if (isReturned) {
    bgClass = 'bg-gray-900';
    borderClass = 'border-gray-900';
  } else if (job.isDifficultDelivery) {
    bgClass = 'bg-orange-50';
    borderClass = 'border-orange-400';
  } else if (isUnitUp) {
    bgClass = 'bg-[#DEE9FB]';
    borderClass = 'border-[#145DDB]/30';
  } else if (isCrane) {
    bgClass = 'bg-[#FCF5E8]';
    borderClass = 'border-[#DB9214]/30';
  } else if (deliveryType?.code === 'UPDWN') {
    bgClass = 'bg-[#DE14C3]/10';
    borderClass = 'border-[#DE14C3]/30';
  } else if (deliveryType?.code === 'MANS') {
    bgClass = 'bg-[#DE145E]/10';
    borderClass = 'border-[#DE145E]/30';
  }

  return (
    <div
      className={`${bgClass} ${borderClass} p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {isReturned ? (
            <div className="mb-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white text-gray-900 flex items-center gap-1 w-fit">
                <ArrowLeft className="h-3 w-3" />
                RETURNED
              </span>
            </div>
          ) : deliveryType?.code && (
            <div className="mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                deliveryType.code === 'UNITUP' ? 'bg-[#145DDB] text-white' :
                deliveryType.code === 'CRANE' ? 'bg-[#DB9214] text-white' :
                deliveryType.code === 'UPDWN' ? 'bg-[#DE14C3] text-white' :
                deliveryType.code === 'MANS' ? 'bg-[#DE145E] text-white' :
                'bg-blue-100 text-blue-700'
              }`}>
                {deliveryType.code}
              </span>
            </div>
          )}
          <span className={`font-semibold text-sm block ${isReturned ? 'text-white' : 'text-gray-900'}`}>{job.customerName}</span>
          {job.customerReference && (
            <p className={`text-xs ${isReturned ? 'text-gray-400' : 'text-blue-600'}`}>Ref: {job.customerReference}</p>
          )}
          <p className={`text-xs mt-1 ${isReturned ? 'text-gray-400' : 'text-gray-500'}`}>{job.deliveryTypeName}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {job.sqm && (
            <Badge variant="outline" className="text-xs">
              {job.sqm.toLocaleString()}m²
            </Badge>
          )}
          {isUnitUp && (
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-[#145DDB]">
              <ArrowUp className="h-3 w-3 text-white" />
            </div>
          )}
          {isCrane && (
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-[#DB9214]">
              <Construction className="h-3 w-3 text-white" />
            </div>
          )}
          {isUnitDelivery && job.totalUnits && (
            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-300">
              {job.totalUnits} units
            </Badge>
          )}
          {job.isDifficultDelivery && (
            <Badge className="bg-orange-500 text-white text-xs border-orange-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Difficult
            </Badge>
          )}
          {hasNonStandard && !job.isDifficultDelivery && (
            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
              Non-Std
            </Badge>
          )}
        </div>
      </div>
      <p className={`text-xs truncate ${isReturned ? 'text-gray-400' : 'text-gray-600'}`}>{job.deliveryLocation}</p>
      {job.pickupLocation && (
        <p className={`text-xs mt-1 ${isReturned ? 'text-gray-500' : 'text-gray-500'}`}>{job.pickupLocation}</p>
      )}
      
      {/* Real-time status indicators */}
      <div className="flex flex-wrap gap-1 mt-2">
        {job.status === 'IN_TRANSIT' && (
          <Badge className="bg-blue-600 text-white text-xs animate-pulse">
            <Truck className="h-3 w-3 mr-1" />
            IN TRANSIT
          </Badge>
        )}
        {job.driverStatus === 'EN_ROUTE' && (
          <Badge className="bg-indigo-600 text-white text-xs">
            <Truck className="h-3 w-3 mr-1" />
            EN ROUTE
          </Badge>
        )}
        {job.driverStatus === 'ARRIVED' && (
          <Badge className="bg-purple-600 text-white text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            ARRIVED
          </Badge>
        )}
        {job.driverStatus === 'UNLOADING' && (
          <Badge className="bg-orange-600 text-white text-xs animate-pulse">
            <Package className="h-3 w-3 mr-1" />
            UNLOADING
          </Badge>
        )}
        {job.driverStatus === 'PROBLEM' && (
          <Badge className="bg-red-600 text-white text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            PROBLEM
          </Badge>
        )}
        {job.status === 'DELIVERED' && (
          <Badge className="bg-green-600 text-white text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            DELIVERED
          </Badge>
        )}
      </div>
      {job.sheetList && job.sheetList.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Items: {job.sheetList.length}</p>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            {job.sheetList.slice(0, 2).map((item, index) => (
              <div key={index} className="truncate">
                {item.quantity} {item.unit} - {item.description}
              </div>
            ))}
            {job.sheetList.length > 2 && (
              <div className="text-gray-500 italic">+{job.sheetList.length - 2} more...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}