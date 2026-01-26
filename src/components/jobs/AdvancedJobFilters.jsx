import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, Truck, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import SavedFilters from './SavedFilters';

const TRUCKS = ['ACCO1', 'ACCO2', 'FUSO', 'ISUZU', 'UD'];

export default function AdvancedJobFilters({
  searchQuery,
  setSearchQuery,
  filters,
  onFiltersChange,
  deliveryTypes = [],
  showAdvanced = true,
  currentUser
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    onFiltersChange({
      status: 'all',
      deliveryType: 'all',
      dateFrom: null,
      dateTo: null,
      truck: 'all',
      sortBy: 'created_date',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = searchQuery.trim() || 
    filters.status !== 'all' || 
    filters.deliveryType !== 'all' ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.truck !== 'all';

  const activeFilterCount = [
    searchQuery.trim(),
    filters.status !== 'all',
    filters.deliveryType !== 'all',
    filters.dateFrom,
    filters.dateTo,
    filters.truck !== 'all'
  ].filter(Boolean).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Main Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by customer, job ID, location, contact, docket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            {showAdvanced && (
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="gap-2 whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                    {activeFilterCount}
                  </Badge>
                )}
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearFilters}
                title="Clear all filters"
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && showAdvancedFilters && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
                <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="RETURNED">Returned</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery Type Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Delivery Type</label>
                <Select value={filters.deliveryType} onValueChange={(value) => updateFilter('deliveryType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {deliveryTypes.map(dt => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.name} ({dt.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Truck Filter */}
              {(currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher' || currentUser?.appRole === 'manager') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assigned Truck</label>
                  <Select value={filters.truck} onValueChange={(value) => updateFilter('truck', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Trucks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Trucks</SelectItem>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {TRUCKS.map(truck => (
                        <SelectItem key={truck} value={truck}>{truck}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sort By */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_date">Date Created</SelectItem>
                    <SelectItem value="requestedDate">Requested Date</SelectItem>
                    <SelectItem value="customerName">Customer Name</SelectItem>
                    <SelectItem value="deliveryLocation">Delivery Location</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Date From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(new Date(filters.dateFrom), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                      onSelect={(date) => updateFilter('dateFrom', date ? format(date, 'yyyy-MM-dd') : null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Date To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(new Date(filters.dateTo), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                      onSelect={(date) => updateFilter('dateTo', date ? format(date, 'yyyy-MM-dd') : null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sort Order */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort Order:</label>
              <Select value={filters.sortOrder} onValueChange={(value) => updateFilter('sortOrder', value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending (A-Z, Old-New)</SelectItem>
                  <SelectItem value="desc">Descending (Z-A, New-Old)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Saved Filters */}
            <div className="pt-3 border-t">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Saved Filters</label>
              <SavedFilters 
                currentFilters={filters} 
                onApplyFilter={(savedFilters) => {
                  onFiltersChange(savedFilters);
                  setShowAdvancedFilters(true);
                }}
              />
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600 pt-2 border-t">
            <span className="font-medium">Active filters:</span>
            {searchQuery && (
              <Badge variant="outline" className="gap-1">
                Search: "{searchQuery}"
              </Badge>
            )}
            {filters.status !== 'all' && (
              <Badge variant="outline" className="gap-1">
                Status: {filters.status.replace(/_/g, ' ')}
              </Badge>
            )}
            {filters.deliveryType !== 'all' && (
              <Badge variant="outline" className="gap-1">
                Type: {deliveryTypes.find(dt => dt.id === filters.deliveryType)?.name}
              </Badge>
            )}
            {filters.truck !== 'all' && (
              <Badge variant="outline" className="gap-1">
                <Truck className="h-3 w-3" />
                {filters.truck}
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="outline" className="gap-1">
                From: {format(new Date(filters.dateFrom), 'MMM d, yyyy')}
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="outline" className="gap-1">
                To: {format(new Date(filters.dateTo), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}